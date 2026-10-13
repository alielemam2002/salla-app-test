// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../../api/product-media.js";
import { isDeepAiOutputUrl, sniffImageType } from "../../../api/_lib/deepai.js";

// Easy Mode store tokens: every store has "access" (see productMediaEndpoint).
vi.mock("../../../api/_lib/merchantTokens.js", async (importOriginal) => ({
  ...(await importOriginal()),
  getAccessToken: vi.fn(async () => "access"),
}));

const KEY = "deepai-test-key";
const INTROSPECT = "https://api.salla.dev/exchange-authority/v1/introspect";
const DEEPAI = "https://api.deepai.org/api/";
const OUTPUT = "https://api.deepai.org/job-view-file/abc/outputs/output.png";
const SALLA_IMAGES = "https://api.salla.dev/admin/v2/products/55/images";
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0,
]);

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status });
const introspectOk = () =>
  json({ success: true, data: { merchant_id: 1, user_id: 2 } });
const deepaiOk = () => json({ id: "job-1", output_url: OUTPUT });

/** Route fetch by URL prefix and record every request. */
function routeFetch(routes) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const href = String(url);
    calls.push({ url: href, method: init.method || "GET", init });
    const route = Object.entries(routes).find(([prefix]) =>
      href.startsWith(prefix),
    );
    if (!route) throw new Error(`Unexpected fetch ${href}`);
    return route[1](init);
  });
  return calls;
}

const call = (body) =>
  POST(
    new Request("http://localhost/api/product-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "tok", appId: "123", ...body }),
    }),
  );

describe("api/product-media AI image studio", () => {
  const savedEnv = { ...process.env };
  let logged;
  beforeEach(() => {
    delete process.env.SALLA_APP_ID;
    process.env.DEEPAI_API_KEY = KEY;
    logged = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...savedEnv };
    vi.restoreAllMocks();
  });

  it("generates an image with text2img and returns DeepAI's result link", async () => {
    const calls = routeFetch({
      [INTROSPECT]: introspectOk,
      [DEEPAI]: deepaiOk,
    });
    const res = await call({
      action: "ai_generate",
      prompt: "white ceramic mug",
      style: "studio",
      quality: "hd",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      output: { id: "job-1", url: OUTPUT },
    });
    expect(JSON.stringify(body)).not.toContain(KEY);

    const deepai = calls[1];
    expect(deepai.url).toBe("https://api.deepai.org/api/text2img");
    expect(deepai.init.headers["api-key"]).toBe(KEY);
    const sent = deepai.init.body;
    expect(sent.get("text")).toMatch(
      /^white ceramic mug, professional e-commerce/,
    );
    expect(sent.get("image_generator_version")).toBe("hd");
    expect(sent.get("width")).toBe("1024");
    expect(sent.get("negative_prompt")).toContain("watermark");
  });

  it("checks the request and the session before calling DeepAI", async () => {
    const calls = routeFetch({
      [INTROSPECT]: introspectOk,
      [DEEPAI]: deepaiOk,
    });
    expect((await call({ action: "ai_generate", prompt: " " })).status).toBe(
      400,
    );
    expect(
      (await call({ action: "ai_generate", prompt: "x", style: "nope" }))
        .status,
    ).toBe(400);
    expect((await call({ action: "nope" })).status).toBe(400);
    expect(calls).toHaveLength(0);

    routeFetch({ [INTROSPECT]: () => json({ success: false }, 401) });
    const res = await call({ action: "ai_generate", prompt: "mug" });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("session_invalid");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("answers ai_not_configured without a key", async () => {
    delete process.env.DEEPAI_API_KEY;
    const calls = routeFetch({ [INTROSPECT]: introspectOk });
    const res = await call({ action: "ai_generate", prompt: "mug" });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("ai_not_configured");
    expect(calls).toHaveLength(1);
  });

  it("maps DeepAI's 402 (no Pro plan) without returning 401 to the app", async () => {
    routeFetch({
      [INTROSPECT]: introspectOk,
      [DEEPAI]: () =>
        json({ status: "APIs are only available for Pro members" }, 402),
    });
    const res = await call({ action: "ai_generate", prompt: "mug" });
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("deepai_not_pro");
    expect(JSON.stringify(logged.mock.calls)).not.toContain(KEY);
  });

  it("improves a product image by URL with the chosen tool", async () => {
    const calls = routeFetch({
      [INTROSPECT]: introspectOk,
      [DEEPAI]: deepaiOk,
    });
    const res = await call({
      action: "ai_improve",
      tool: "remove_background",
      imageUrl: "https://cdn.salla.sa/img/front.jpg",
      text: "ignored",
    });
    expect(res.status).toBe(200);
    expect(calls[1].url).toBe("https://api.deepai.org/api/background-remover");
    expect(calls[1].init.body.get("image")).toBe(
      "https://cdn.salla.sa/img/front.jpg",
    );
    expect(calls[1].init.body.get("text")).toBeNull();

    // The editor needs a description; links must be https.
    expect(
      (await call({ action: "ai_improve", tool: "edit", imageUrl: OUTPUT }))
        .status,
    ).toBe(400);
    expect(
      (
        await call({
          action: "ai_improve",
          tool: "upscale",
          imageUrl: "http://example.com/a.jpg",
        })
      ).status,
    ).toBe(400);
  });

  it("improves a file sent from the device (multipart)", async () => {
    const calls = routeFetch({
      [INTROSPECT]: introspectOk,
      [DEEPAI]: deepaiOk,
    });
    const form = new FormData();
    form.append("action", "ai_improve");
    form.append("token", "tok");
    form.append("appId", "123");
    form.append("tool", "edit");
    form.append("text", "on a marble table");
    form.append(
      "image",
      new File([PNG], "raw.png", { type: "image/png" }),
      "raw.png",
    );
    const res = await POST(
      new Request("http://localhost/api/product-media", {
        method: "POST",
        body: form,
      }),
    );
    expect(res.status).toBe(200);
    expect(calls[1].url).toBe("https://api.deepai.org/api/image-editor");
    expect(calls[1].init.body.get("image").name).toBe("raw.png");
    expect(calls[1].init.body.get("text")).toBe("on a marble table");
  });

  it("attaches a result: downloads it from DeepAI and sends it to Salla", async () => {
    const calls = routeFetch({
      [INTROSPECT]: introspectOk,
      [OUTPUT]: () =>
        new Response(PNG, {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" },
        }),
      [SALLA_IMAGES]: () =>
        json({ success: true, data: { id: 9, type: "image" } }, 201),
    });
    const res = await call({
      action: "ai_attach",
      productId: "55",
      url: OUTPUT,
      main: true,
      sort: 5,
      alt: "Mug",
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      success: true,
      image: { id: 9, type: "image" },
    });
    const upload = calls.find((c) => c.url === SALLA_IMAGES);
    expect(upload.method).toBe("POST");
    const photo = upload.init.body.get("photo");
    expect(photo.type).toBe("image/png");
    expect(photo.name).toBe("ai-image.png");
    expect(upload.init.body.get("main")).toBe("true");
    expect(upload.init.body.get("sort")).toBe("5");
    expect(upload.init.body.get("alt")).toBe("Mug");
    expect(upload.init.headers.Authorization).toBe("Bearer access");
  });

  it("only downloads DeepAI links, and only real images", async () => {
    const calls = routeFetch({ [INTROSPECT]: introspectOk });
    const res = await call({
      action: "ai_attach",
      productId: "55",
      url: "https://169.254.169.254/latest/meta-data",
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid_output_url");
    expect(calls).toHaveLength(0);

    const calls2 = routeFetch({
      [INTROSPECT]: introspectOk,
      [OUTPUT]: () => new Response("<html>", { status: 200 }),
    });
    const bad = await call({
      action: "ai_attach",
      productId: "55",
      url: OUTPUT,
    });
    expect(bad.status).toBe(502);
    expect((await bad.json()).code).toBe("bad_output");
    expect(calls2.some((c) => c.url === SALLA_IMAGES)).toBe(false);
  });
});

describe("deepai helpers", () => {
  it("accepts only https DeepAI hosts", () => {
    expect(isDeepAiOutputUrl(OUTPUT)).toBe(true);
    expect(isDeepAiOutputUrl("https://images.deepai.org/x.jpg")).toBe(true);
    expect(isDeepAiOutputUrl("http://api.deepai.org/x.jpg")).toBe(false);
    expect(isDeepAiOutputUrl("https://deepai.org.evil.com/x.jpg")).toBe(false);
    expect(isDeepAiOutputUrl("https://evil.com/?u=deepai.org")).toBe(false);
    expect(isDeepAiOutputUrl("https://a@api.deepai.org/x.jpg")).toBe(false);
    expect(isDeepAiOutputUrl("https://api.deepai.org:8443/x.jpg")).toBe(false);
  });

  it("sniffs png, jpeg and webp", () => {
    expect(sniffImageType(PNG.buffer).type).toBe("image/png");
    expect(
      sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer).ext,
    ).toBe("jpg");
    const webp = new TextEncoder().encode("RIFF0000WEBPVP8 ");
    expect(sniffImageType(webp.buffer).type).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg>").buffer)).toBeNull();
  });
});
