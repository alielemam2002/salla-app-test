// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { POST } from "../../../../api/whatsapp.js";
import { buildTemplateMessage } from "../../../../api/_lib/whatsappGraph.js";
import {
  envConfig,
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
 * Fake network: Salla introspect + cart, an in-memory Upstash, and Meta.
 * `meta` decides Meta's answer per call. Every request is recorded.
 */
function mockNetwork({ merchantId = 1, meta, cart = CART } = {}) {
  const kv = new Map();
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
    if (u.includes("/carts/abandoned/")) {
      return json(200, { success: true, data: cart });
    }
    if (u.includes("graph.facebook.com")) {
      const res = meta?.({
        url: u,
        method: init.method || "GET",
        body,
        headers: init.headers,
      }) || {
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

const saved = { ...process.env };

describe("api/whatsapp", () => {
  beforeEach(() => {
    process.env.SALLA_ACCESS_TOKEN = "access";
    process.env.KV_REST_API_URL = KV_URL;
    process.env.KV_REST_API_TOKEN = "kv-token";
    process.env.WA_SETTINGS_KEY = randomBytes(32).toString("base64");
    process.env.META_WA_TOKEN = "server-default-token";
    process.env.META_WA_PHONE_NUMBER_ID = "999999999";
    delete process.env.META_WA_TEMPLATE_NAME;
    delete process.env.META_WA_TEMPLATE_LANG;
    delete process.env.META_WA_TEMPLATE_PARAMS;
    delete process.env.META_GRAPH_VERSION;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("uses the server default until the merchant connects their own account", async () => {
    mockNetwork();
    const json = await (await call({ action: "status" })).json();
    expect(json).toMatchObject({
      configured: true,
      source: "server",
      storageReady: true,
      template: "hello_world",
      language: "en_US",
    });
    expect(JSON.stringify(json)).not.toContain("server-default-token");
  });

  it("checks settings with Meta, stores the token encrypted and never returns it", async () => {
    const { calls, kv } = mockNetwork();
    const res = await call({ action: "settings_save", settings: SETTINGS });
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.settings).toMatchObject({
      phoneNumberId: SETTINGS.phoneNumberId,
      template: "cart_reminder_ar",
      tokenLast4: "abcd",
      profile: { displayPhone: "15551890829", verifiedName: "Test Store" },
    });
    expect(JSON.stringify(json)).not.toContain(SETTINGS.accessToken);

    // Meta was asked about this phone number with the merchant's token.
    const probe = calls.find((c) => c.url.includes("graph.facebook.com"));
    expect(probe.url).toContain(`/${SETTINGS.phoneNumberId}?fields=`);
    expect(probe.headers.Authorization).toBe(`Bearer ${SETTINGS.accessToken}`);

    // Stored per merchant, token sealed.
    const record = JSON.parse(kv.get("wa:settings:1"));
    expect(JSON.stringify(record)).not.toContain(SETTINGS.accessToken);
    expect(open(record.token)).toBe(SETTINGS.accessToken);

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
    const res = await call({ action: "settings_save", settings: SETTINGS });
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
    await call({ action: "settings_save", settings: SETTINGS });
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
    const { calls } = mockNetwork({ merchantId: 1 });
    await call({ action: "settings_save", settings: SETTINGS });
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
    const first = mockNetwork({ merchantId: 1 });
    await call({ action: "settings_save", settings: SETTINGS });
    // Same storage, different merchant: they get the server default.
    const { kv } = first;
    globalThis.fetch.mockClear();
    const other = mockNetwork({ merchantId: 2 });
    other.kv.set("wa:settings:1", kv.get("wa:settings:1"));
    const status = await (await call({ action: "status" })).json();
    expect(status.source).toBe("server");
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
    expect(status).toMatchObject({ configured: false, tokenUnreadable: true });
    const send = await call({ action: "send", cartId: 77 });
    expect(send.status).toBe(503);
    expect((await send.json()).error).toMatch(/Enter it again/);
  });

  it("refuses to save settings without storage", async () => {
    delete process.env.KV_REST_API_URL;
    mockNetwork();
    const res = await call({ action: "settings_save", settings: SETTINGS });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("storage_not_configured");
  });

  it("won't message a purchased cart or a customer without a number", async () => {
    mockNetwork({ cart: { ...CART, status: "purchased" } });
    expect((await call({ action: "send", cartId: 77 })).status).toBe(409);
    mockNetwork({ cart: { ...CART, customer: { name: "X" } } });
    expect((await call({ action: "send", cartId: 77 })).status).toBe(422);
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
                  error_data: { details: "template name does not exist in ar" },
                },
              },
            }
          : null,
    });
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

  it("reads the server default and builds template bodies", () => {
    expect(envConfig({})).toBeNull();
    const config = envConfig({
      META_WA_TOKEN: "t",
      META_WA_PHONE_NUMBER_ID: "1",
      META_WA_TEMPLATE_PARAMS: "customer_name, store_name",
    });
    expect(config).toMatchObject({
      template: "hello_world",
      language: "en_US",
      invalidParams: ["store_name"],
    });
    expect(
      buildTemplateMessage({ ...config, params: [] }, "966", {}).body.template,
    ).toEqual({ name: "hello_world", language: { code: "en_US" } });
    expect(
      buildTemplateMessage({ ...config, params: ["coupon_code"] }, "966", {
        coupon_code: "",
      }).error,
    ).toMatch(/coupon_code/);
  });
});
