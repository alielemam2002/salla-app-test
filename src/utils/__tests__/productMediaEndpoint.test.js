// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as uploadPost } from "../../../api/product-media.js";
import { POST as productsPost } from "../../../api/products.js";

// Easy Mode: each store's OAuth token comes from storage (app.store.authorize).
// Here store 999 never authorized the app; every other store has "access".
vi.mock("../../../api/_lib/merchantTokens.js", async (importOriginal) => ({
  ...(await importOriginal()),
  getAccessToken: vi.fn(async (merchantId) => {
    if (String(merchantId) !== "999") return "access";
    const error = new Error("not authorized");
    error.code = "store_not_authorized";
    error.status = 403;
    throw error;
  }),
}));

const INTROSPECT_OK = {
  status: 200,
  body: { success: true, data: { merchant_id: 1, user_id: 2 } },
};

/** Queue fetch responses in call order and record requests. */
function mockFetch(responses) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", init });
    const next = responses[calls.length - 1] || responses[responses.length - 1];
    return new Response(JSON.stringify(next.body), { status: next.status });
  });
  return calls;
}

function uploadRequest(fields) {
  const form = new FormData();
  Object.entries({ token: "tok", appId: "123", productId: "55", ...fields })
    .filter(([, v]) => v !== undefined)
    .forEach(([k, v]) => form.append(k, v));
  return uploadPost(
    new Request("http://localhost/api/product-media", {
      method: "POST",
      body: form,
    }),
  );
}

const jpeg = (size = 10) =>
  new File([new Uint8Array(size)], "front.jpg", { type: "image/jpeg" });

const productsCall = (body) =>
  productsPost(
    new Request("http://localhost/api/products", {
      method: "POST",
      body: JSON.stringify({ token: "tok", appId: "123", ...body }),
    }),
  );

describe("api/product-media (image upload)", () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    process.env.SALLA_ACCESS_TOKEN = "access";
    delete process.env.SALLA_APP_ID;
  });
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("forwards the file to Salla's Attach Image endpoint as multipart", async () => {
    const calls = mockFetch([
      INTROSPECT_OK,
      { status: 201, body: { success: true, data: { id: 9, type: "image" } } },
    ]);
    const res = await uploadRequest({
      photo: jpeg(),
      main: "true",
      sort: "3",
      alt: "Tee",
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      success: true,
      image: { id: 9, type: "image" },
    });
    const upload = calls[1];
    expect(upload.url).toBe(
      "https://api.salla.dev/admin/v2/products/55/images",
    );
    expect(upload.method).toBe("POST");
    const sent = upload.init.body;
    expect(sent).toBeInstanceOf(FormData);
    expect(sent.get("photo").name).toBe("front.jpg");
    expect(sent.get("main")).toBe("true");
    expect(sent.get("sort")).toBe("3");
    expect(sent.get("alt")).toBe("Tee");
    // fetch sets the multipart boundary; we must not force a Content-Type.
    expect(upload.init.headers["Content-Type"]).toBeUndefined();
    expect(upload.init.headers.Authorization).toBe("Bearer access");
  });

  it("rejects non-images, missing files and bad product ids before calling Salla", async () => {
    const calls = mockFetch([INTROSPECT_OK]);
    const video = new File([new Uint8Array(5)], "v.mp4", { type: "video/mp4" });
    expect((await uploadRequest({ photo: video })).status).toBe(415);
    expect((await uploadRequest({})).status).toBe(400);
    expect(
      (await uploadRequest({ photo: jpeg(), productId: "../x" })).status,
    ).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("passes Salla's validation error through", async () => {
    mockFetch([
      INTROSPECT_OK,
      {
        status: 422,
        body: {
          success: false,
          error: { message: "too many images", fields: { photo: ["max"] } },
        },
      },
    ]);
    const res = await uploadRequest({ photo: jpeg() });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      code: "salla_api_error",
      error: "too many images",
      fields: { photo: ["max"] },
    });
  });

  it("rejects an invalid session", async () => {
    mockFetch([{ status: 401, body: { success: false } }]);
    const res = await uploadRequest({ photo: jpeg() });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("session_invalid");
  });
});

describe("api/products media actions", () => {
  beforeEach(() => {
    process.env.SALLA_ACCESS_TOKEN = "access";
  });

  it("deletes an image with the documented DELETE /products/images/{image}", async () => {
    const calls = mockFetch([
      INTROSPECT_OK,
      { status: 200, body: { success: true, data: {} } },
    ]);
    const res = await productsCall({
      action: "image_delete",
      productId: 55,
      imageId: 9,
    });
    expect((await res.json()).success).toBe(true);
    expect(calls[1]).toMatchObject({
      url: "https://api.salla.dev/admin/v2/products/images/9",
      method: "DELETE",
    });
  });

  it("lists images from Product Details", async () => {
    const images = [{ id: 1, url: "u", type: "image", sort: 1 }];
    const calls = mockFetch([
      INTROSPECT_OK,
      { status: 200, body: { success: true, data: { id: 55, images } } },
    ]);
    const res = await productsCall({ action: "images_list", productId: 55 });
    expect(await res.json()).toEqual({ success: true, images });
    expect(calls[1].url).toBe("https://api.salla.dev/admin/v2/products/55");
  });

  it("adds a YouTube video and refuses other links", async () => {
    const calls = mockFetch([
      INTROSPECT_OK,
      { status: 201, body: { success: true, data: { id: 7, type: "video" } } },
    ]);
    const ok = await productsCall({
      action: "video_attach",
      productId: 55,
      videoUrl: "https://www.youtube.com/watch?v=dmqWuUeA5Ug",
    });
    expect((await ok.json()).video).toEqual({ id: 7, type: "video" });
    expect(calls[1]).toMatchObject({
      url: "https://api.salla.dev/admin/v2/products/55/video",
      method: "POST",
    });
    expect(JSON.parse(calls[1].init.body)).toEqual({
      video_url: "https://www.youtube.com/watch?v=dmqWuUeA5Ug",
    });

    mockFetch([INTROSPECT_OK]);
    const bad = await productsCall({
      action: "video_attach",
      productId: 55,
      videoUrl: "https://example.com/clip.mp4",
    });
    expect(bad.status).toBe(422);
  });
});
