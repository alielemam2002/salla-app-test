// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { POST } from "../../../../api/whatsapp.js";
import { buildTemplateMessage } from "../../../../api/_lib/whatsappGraph.js";
import {
  graphVersion,
  validateSettingsInput,
} from "../../../../api/_lib/whatsappSettings.js";
import { open, seal } from "../../../../api/_lib/secretBox.js";

const KV_URL = "https://kv.example.upstash.io";

const CART = {
  id: 77,
  status: "active",
  total: { amount: 420, currency: "SAR" },
  checkout_url: "https://salla.sa/store/checkout/77",
  customer: { name: "Ahmed Ali", mobile: "+966560000001" },
  items: [{ quantity: 2 }, { quantity: 1 }],
};

const PROFILE = {
  display_phone_number: "15551890829",
  verified_name: "Test Store",
  quality_rating: "GREEN",
};

/**
 * Fake network: Salla introspect + carts (by id), an in-memory Upstash
 * (pass `kv` to share it between merchants), and Meta (`meta` can
 * override its answer). Every request is recorded in `calls`.
 */
function mockNetwork({
  merchantId = 1,
  meta,
  carts = { 77: CART },
  kv = new Map(),
} = {}) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({
      url: u,
      method: init.method || "GET",
      headers: init.headers || {},
      body,
    });
    const json = (status, data) =>
      new Response(JSON.stringify(data), { status });

    if (u.includes("introspect")) {
      return json(200, {
        success: true,
        data: { merchant_id: merchantId, user_id: 2 },
      });
    }
    if (u.startsWith(KV_URL)) {
      const [cmd, key, value] = body;
      if (cmd === "SET") kv.set(key, value);
      if (cmd === "DEL") kv.delete(key);
      return json(200, {
        result: cmd === "GET" ? (kv.get(key) ?? null) : "OK",
      });
    }
    const cartMatch = u.match(/\/carts\/abandoned\/(\d+)/);
    if (cartMatch) {
      const cart = carts[cartMatch[1]];
      return cart
        ? json(200, { success: true, data: cart })
        : json(404, { success: false, error: { message: "not found" } });
    }
    if (u.includes("graph.facebook.com")) {
      const res = meta?.({ url: u, body }) || {
        status: 200,
        body: u.includes("/messages")
          ? { messages: [{ id: "wamid.X", message_status: "accepted" }] }
          : PROFILE,
      };
      return json(res.status, res.body);
    }
    return json(404, { success: false });
  });
  return { calls, kv };
}

const call = (body) =>
  POST(
    new Request("http://localhost/api/whatsapp", {
      method: "POST",
      body: JSON.stringify({ token: "tok", appId: "123", ...body }),
    }),
  );

const SETTINGS = {
  phoneNumberId: "1324055010792496",
  wabaId: "1478536534308215",
  accessToken: "EAAmerchantTokenValue1234abcd",
  template: "cart_reminder_ar",
  language: "ar",
  params: ["customer_name", "cart_total", "checkout_url"],
};

const connect = () => call({ action: "settings_save", settings: SETTINGS });

const saved = { ...process.env };

describe("api/whatsapp", () => {
  beforeEach(() => {
    process.env.SALLA_ACCESS_TOKEN = "access";
    process.env.KV_REST_API_URL = KV_URL;
    process.env.KV_REST_API_TOKEN = "kv-token";
    process.env.WA_SETTINGS_KEY = randomBytes(32).toString("base64");
    // A leftover shared account in env must never be used.
    process.env.META_WA_TOKEN = "old-shared-token";
    process.env.META_WA_PHONE_NUMBER_ID = "999999999";
    delete process.env.META_GRAPH_VERSION;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("is manual-only until the merchant connects their own account", async () => {
    const { calls } = mockNetwork();
    const status = await (await call({ action: "status" })).json();
    expect(status).toMatchObject({
      connected: false,
      enabled: false,
      configured: false,
      storageReady: true,
    });
    const send = await call({ action: "send", cartId: 77 });
    expect(send.status).toBe(503);
    expect((await send.json()).code).toBe("whatsapp_not_configured");
    expect(calls.some((c) => c.url.includes("graph.facebook.com"))).toBe(false);
  });

  it("checks settings with Meta, stores the token encrypted and never returns it", async () => {
    const { calls, kv } = mockNetwork();
    const json = await (await connect()).json();
    expect(json.success).toBe(true);
    expect(json.settings).toMatchObject({
      phoneNumberId: SETTINGS.phoneNumberId,
      template: "cart_reminder_ar",
      tokenLast4: "abcd",
      enabled: true,
      profile: { displayPhone: "15551890829", verifiedName: "Test Store" },
    });
    expect(JSON.stringify(json)).not.toContain(SETTINGS.accessToken);

    const probe = calls.find((c) => c.url.includes("graph.facebook.com"));
    expect(probe.url).toContain(`/${SETTINGS.phoneNumberId}?fields=`);
    expect(probe.headers.Authorization).toBe(`Bearer ${SETTINGS.accessToken}`);

    const record = JSON.parse(kv.get("wa:settings:1"));
    expect(JSON.stringify(record)).not.toContain(SETTINGS.accessToken);
    expect(open(record.token)).toBe(SETTINGS.accessToken);

    const status = await (await call({ action: "status" })).json();
    expect(status).toMatchObject({
      connected: true,
      enabled: true,
      configured: true,
    });
    const get = await (await call({ action: "settings_get" })).json();
    expect(get.settings.tokenLast4).toBe("abcd");
    expect(JSON.stringify(get)).not.toContain(SETTINGS.accessToken);
  });

  it("doesn't save settings Meta rejects", async () => {
    const { kv } = mockNetwork({
      meta: () => ({
        status: 401,
        body: { error: { code: 190, message: "expired" } },
      }),
    });
    const res = await connect();
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      code: "meta_error",
      metaCode: 190,
      error: expect.stringMatching(/token expired/),
    });
    expect(kv.size).toBe(0);
  });

  it("keeps the saved token when the field is left empty", async () => {
    const { kv, calls } = mockNetwork();
    await connect();
    await call({
      action: "settings_save",
      settings: { ...SETTINGS, accessToken: "", template: "cart_reminder_v2" },
    });
    const record = JSON.parse(kv.get("wa:settings:1"));
    expect(record.template).toBe("cart_reminder_v2");
    expect(open(record.token)).toBe(SETTINGS.accessToken);
    const probes = calls.filter((c) => c.url.includes("fields="));
    expect(probes[1].headers.Authorization).toBe(
      `Bearer ${SETTINGS.accessToken}`,
    );
  });

  it("sends each merchant's reminders with their own account", async () => {
    const { calls } = mockNetwork();
    await connect();
    const res = await call({ action: "send", cartId: 77 });
    expect(await res.json()).toEqual({
      success: true,
      messageId: "wamid.X",
      status: "accepted",
    });
    const send = calls.find((c) => c.url.endsWith("/messages"));
    expect(send.url).toBe(
      `https://graph.facebook.com/v23.0/${SETTINGS.phoneNumberId}/messages`,
    );
    expect(send.headers.Authorization).toBe(`Bearer ${SETTINGS.accessToken}`);
    expect(send.body.template).toEqual({
      name: "cart_reminder_ar",
      language: { code: "ar" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "Ahmed" },
            { type: "text", text: "SAR 420" },
            { type: "text", text: "https://salla.sa/store/checkout/77" },
          ],
        },
      ],
    });
  });

  it("keeps merchants apart", async () => {
    const kv = new Map();
    mockNetwork({ merchantId: 1, kv });
    await connect();
    mockNetwork({ merchantId: 2, kv });
    const status = await (await call({ action: "status" })).json();
    expect(status.connected).toBe(false);
    expect((await call({ action: "send", cartId: 77 })).status).toBe(503);
  });

  it("refuses to send while the switch is off, but still sends a test", async () => {
    const { calls } = mockNetwork();
    await connect();
    const off = await (
      await call({ action: "settings_enable", enabled: false })
    ).json();
    expect(off.settings.enabled).toBe(false);

    const status = await (await call({ action: "status" })).json();
    expect(status).toMatchObject({
      connected: true,
      enabled: false,
      configured: false,
    });
    const send = await call({ action: "send", cartId: 77 });
    expect(send.status).toBe(403);
    expect((await send.json()).code).toBe("whatsapp_disabled");
    expect(calls.some((c) => c.url.endsWith("/messages"))).toBe(false);

    const test = await call({ action: "send_test", to: "+201060820691" });
    expect((await test.json()).success).toBe(true);

    await call({ action: "settings_enable", enabled: true });
    expect((await call({ action: "send", cartId: 77 })).status).toBe(200);
  });

  it("can't switch on before connecting", async () => {
    mockNetwork();
    const res = await call({ action: "settings_enable", enabled: true });
    expect(res.status).toBe(503);
  });

  it("asks for the token again when it can't be decrypted", async () => {
    const { kv } = mockNetwork();
    kv.set(
      "wa:settings:1",
      JSON.stringify({
        ...SETTINGS,
        token: seal("old-token"),
        tokenLast4: "oken",
        params: [],
      }),
    );
    process.env.WA_SETTINGS_KEY = randomBytes(32).toString("base64");
    const status = await (await call({ action: "status" })).json();
    expect(status).toMatchObject({ connected: false, tokenUnreadable: true });
    const send = await call({ action: "send", cartId: 77 });
    expect(send.status).toBe(503);
    expect((await send.json()).error).toMatch(/Enter it again/);
  });

  it("refuses to save settings without storage", async () => {
    delete process.env.KV_REST_API_URL;
    mockNetwork();
    const res = await connect();
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("storage_not_configured");
  });

  it("won't message a purchased cart or a customer without a number", async () => {
    mockNetwork({
      carts: {
        77: { ...CART, status: "purchased" },
        78: { ...CART, id: 78, customer: { name: "X" } },
      },
    });
    await connect();
    expect((await call({ action: "send", cartId: 77 })).status).toBe(409);
    expect((await call({ action: "send", cartId: 78 })).status).toBe(422);
  });

  it("explains Meta errors instead of passing them raw", async () => {
    mockNetwork({
      meta: ({ url }) =>
        url.endsWith("/messages")
          ? {
              status: 400,
              body: {
                error: {
                  code: 132001,
                  message: "(#132001) Template name does not exist",
                  error_data: {
                    details: "template name does not exist in ar",
                  },
                },
              },
            }
          : null,
    });
    await connect();
    const res = await call({ action: "send", cartId: 77 });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      code: "meta_error",
      metaCode: 132001,
      error:
        "The template doesn't exist in this language or isn't approved yet.",
      detail: "template name does not exist in ar",
    });
  });

  it("sends a test with sample data to a given number", async () => {
    const { calls } = mockNetwork();
    await connect();
    const res = await call({ action: "send_test", to: "+20 106 082 0691" });
    expect((await res.json()).success).toBe(true);
    const send = calls.find((c) => c.url.endsWith("/messages"));
    expect(send.body.to).toBe("201060820691");
    expect((await call({ action: "send_test", to: "0106" })).status).toBe(422);
  });
});

describe("whatsapp settings helpers", () => {
  it("validates what the merchant typed", () => {
    expect(
      validateSettingsInput({ ...SETTINGS, params: ["store_name"] }).fields
        .params,
    ).toBeTruthy();
    expect(
      validateSettingsInput({ ...SETTINGS, accessToken: "" }).fields
        .accessToken,
    ).toBeTruthy();
    expect(
      validateSettingsInput(
        { ...SETTINGS, accessToken: "" },
        { hasSavedToken: true },
      ).values,
    ).toBeTruthy();
    expect(
      validateSettingsInput({ ...SETTINGS, template: "Cart Reminder" }).fields
        .template,
    ).toBeTruthy();
  });

  it("builds template bodies and picks the Graph version", () => {
    expect(graphVersion({})).toBe("v23.0");
    expect(graphVersion({ META_GRAPH_VERSION: "v24.0" })).toBe("v24.0");
    const config = {
      template: "hello_world",
      language: "en_US",
      params: [],
    };
    expect(buildTemplateMessage(config, "966", {}).body.template).toEqual({
      name: "hello_world",
      language: { code: "en_US" },
    });
    expect(
      buildTemplateMessage({ ...config, params: ["coupon_code"] }, "966", {
        coupon_code: "",
      }).error,
    ).toMatch(/coupon_code/);
  });
});
