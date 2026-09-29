// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POST,
  buildTemplateMessage,
  readConfig,
} from "../../../../api/whatsapp.js";

const INTROSPECT_OK = {
  status: 200,
  body: { success: true, data: { merchant_id: 1, user_id: 2 } },
};

const CART = {
  id: 77,
  status: "active",
  total: { amount: 420, currency: "SAR" },
  checkout_url: "https://salla.sa/store/checkout/77",
  customer: { name: "Ahmed Ali", mobile: "+966560000001" },
  items: [{ quantity: 2 }, { quantity: 1 }],
};

/** Route by URL; record every request (with headers and parsed body). */
function mockFetch(routes) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url);
    calls.push({
      url: u,
      headers: init.headers || {},
      body: init.body ? JSON.parse(init.body) : undefined,
    });
    const key = Object.keys(routes).find((k) => u.includes(k));
    const res = routes[key] || { status: 404, body: { success: false } };
    return new Response(JSON.stringify(res.body), { status: res.status });
  });
  return calls;
}

const call = (body) =>
  POST(
    new Request("http://localhost/api/whatsapp", {
      method: "POST",
      body: JSON.stringify({ token: "tok", appId: "123", ...body }),
    }),
  );

const saved = { ...process.env };

describe("api/whatsapp", () => {
  beforeEach(() => {
    process.env.SALLA_ACCESS_TOKEN = "access";
    process.env.META_WA_TOKEN = "meta-secret";
    process.env.META_WA_PHONE_NUMBER_ID = "1324055010792496";
    process.env.META_WA_TEMPLATE_NAME = "cart_reminder";
    process.env.META_WA_TEMPLATE_LANG = "ar";
    process.env.META_WA_TEMPLATE_PARAMS =
      "customer_name,cart_total,checkout_url";
    delete process.env.META_GRAPH_VERSION;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("reports its setup without ever returning the token", async () => {
    mockFetch({ introspect: INTROSPECT_OK });
    const json = await (await call({ action: "status" })).json();
    expect(json).toEqual({
      success: true,
      configured: true,
      template: "cart_reminder",
      language: "ar",
      params: ["customer_name", "cart_total", "checkout_url"],
      invalidParams: [],
    });
    expect(JSON.stringify(json)).not.toContain("meta-secret");
  });

  it("reads the cart from Salla and sends the template to Meta", async () => {
    const calls = mockFetch({
      introspect: INTROSPECT_OK,
      "/carts/abandoned/77": {
        status: 200,
        body: { success: true, data: CART },
      },
      "graph.facebook.com": {
        status: 200,
        body: {
          messaging_product: "whatsapp",
          contacts: [{ input: "966560000001", wa_id: "966560000001" }],
          messages: [{ id: "wamid.X", message_status: "accepted" }],
        },
      },
    });
    const res = await call({ action: "send", cartId: 77 });
    expect(await res.json()).toEqual({
      success: true,
      messageId: "wamid.X",
      status: "accepted",
    });

    const meta = calls.find((c) => c.url.includes("graph.facebook.com"));
    expect(meta.url).toBe(
      "https://graph.facebook.com/v23.0/1324055010792496/messages",
    );
    expect(meta.headers.Authorization).toBe("Bearer meta-secret");
    expect(meta.body).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "966560000001",
      type: "template",
      template: {
        name: "cart_reminder",
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
      },
    });
  });

  it("won't message a purchased cart or a customer without a number", async () => {
    const calls = mockFetch({
      introspect: INTROSPECT_OK,
      "/carts/abandoned/77": {
        status: 200,
        body: { success: true, data: { ...CART, status: "purchased" } },
      },
      "/carts/abandoned/78": {
        status: 200,
        body: { success: true, data: { ...CART, customer: { name: "X" } } },
      },
    });
    expect((await call({ action: "send", cartId: 77 })).status).toBe(409);
    expect((await call({ action: "send", cartId: 78 })).status).toBe(422);
    expect(calls.some((c) => c.url.includes("graph.facebook.com"))).toBe(false);
  });

  it("explains Meta errors instead of passing them raw", async () => {
    mockFetch({
      introspect: INTROSPECT_OK,
      "/carts/abandoned/77": {
        status: 200,
        body: { success: true, data: CART },
      },
      "graph.facebook.com": {
        status: 400,
        body: {
          error: {
            message:
              "(#132001) Template name does not exist in the translation",
            code: 132001,
            error_data: {
              details: "template name (cart_reminder) does not exist in ar",
            },
          },
        },
      },
    });
    const res = await call({ action: "send", cartId: 77 });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json).toMatchObject({
      code: "meta_error",
      metaCode: 132001,
      error:
        "The template doesn't exist in this language or isn't approved yet.",
      detail: "template name (cart_reminder) does not exist in ar",
    });
  });

  it("refuses to send when WhatsApp isn't configured", async () => {
    delete process.env.META_WA_TOKEN;
    const calls = mockFetch({ introspect: INTROSPECT_OK });
    const res = await call({ action: "send", cartId: 77 });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("whatsapp_not_configured");
    expect(calls).toHaveLength(1); // only introspect
  });

  it("builds template bodies and rejects empty variables", () => {
    const config = readConfig({
      META_WA_TOKEN: "t",
      META_WA_PHONE_NUMBER_ID: "1",
      META_WA_TEMPLATE_PARAMS: "customer_name, coupon_code, store_name",
    });
    expect(config.template).toBe("hello_world");
    expect(config.language).toBe("en_US");
    expect(config.invalidParams).toEqual(["store_name"]);
    const noParams = buildTemplateMessage(
      readConfig({ META_WA_TOKEN: "t", META_WA_PHONE_NUMBER_ID: "1" }),
      "966",
      {},
    );
    expect(noParams.body.template).toEqual({
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
