// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { POST as whatsapp } from "../../../../api/whatsapp.js";
import { POST as replenish } from "../../../../api/replenish.js";
import { buildBoundMessage } from "../../../../api/_lib/whatsappGraph.js";
import { seal } from "../../../../api/_lib/secretBox.js";
import { fakeRedis } from "../../../test/fakeRedis.js";
import {
  BINDING_SOURCES,
  defaultSlots,
  previewText,
  resolveBinding,
  urlButtonValue,
} from "../templateBinding.js";

// Easy Mode store token for the cart lookups.
vi.mock("../../../../api/_lib/merchantTokens.js", async (importOriginal) => ({
  ...(await importOriginal()),
  getAccessToken: vi.fn(async () => "access"),
}));

const KV_URL = "https://kv.example.upstash.io";

// The library as read from Meta (normalizeTemplate shape).
const CART_TEMPLATE = {
  id: "111",
  name: "cart_reminder_ar",
  language: "ar",
  status: "APPROVED",
  category: "MARKETING",
  parameterFormat: "POSITIONAL",
  header: { format: "TEXT", text: "مرحبًا {{1}}" },
  body: "سلتك بقيمة {{1}} بانتظارك، {{2}}",
  footer: null,
  buttons: [{ type: "URL", text: "أكمل الطلب", url: "https://salla.sa/{{1}}" }],
  variables: {
    header: ["1"],
    body: ["1", "2"],
    buttons: [{ index: 0, text: "أكمل الطلب", url: "https://salla.sa/{{1}}" }],
  },
};
const NAMED_TEMPLATE = {
  id: "222",
  name: "offer_named",
  language: "en_US",
  status: "APPROVED",
  category: "MARKETING",
  parameterFormat: "NAMED",
  header: null,
  body: "Hi {{first_name}}, use {{code}}",
  footer: null,
  buttons: [],
  variables: { header: [], body: ["first_name", "code"], buttons: [] },
};
const PENDING = { ...NAMED_TEMPLATE, id: "333", status: "PENDING" };
const LIBRARY = [CART_TEMPLATE, NAMED_TEMPLATE, PENDING];

const CART_SLOTS = [
  { part: "header", name: "1", source: "customer_name" },
  { part: "body", name: "1", source: "cart_total" },
  { part: "body", name: "2", source: "custom", value: "خصم خاص لك" },
  { part: "button", name: "1", index: 0, source: "checkout_url" },
];

describe("template bindings", () => {
  it("checks a binding against the library, not the browser", () => {
    const { binding } = resolveBinding(
      { templateId: "111", name: "evil", language: "xx", slots: CART_SLOTS },
      LIBRARY,
      BINDING_SOURCES.cart,
    );
    expect(binding).toMatchObject({
      templateId: "111",
      name: "cart_reminder_ar",
      language: "ar",
      slots: [
        { part: "header", name: "1", source: "customer_name" },
        { part: "body", name: "1", source: "cart_total" },
        { part: "body", name: "2", source: "custom", value: "خصم خاص لك" },
        {
          part: "button",
          index: 0,
          url: "https://salla.sa/{{1}}",
          source: "checkout_url",
        },
      ],
    });

    const src = BINDING_SOURCES.cart;
    expect(resolveBinding({ templateId: "999" }, LIBRARY, src).error).toMatch(
      /اختر قالبًا/,
    );
    expect(resolveBinding({ templateId: "333" }, LIBRARY, src).error).toMatch(
      /غير معتمد/,
    );
    // Every variable must be filled, with a value the feature has.
    expect(
      resolveBinding(
        { templateId: "111", slots: CART_SLOTS.slice(0, 3) },
        LIBRARY,
        src,
      ).error,
    ).toMatch(/رابط زر «أكمل الطلب»/);
    expect(
      resolveBinding(
        {
          templateId: "111",
          slots: CART_SLOTS.map((s) =>
            s.part === "header" ? { ...s, source: "product_url" } : s,
          ),
        },
        LIBRARY,
        src,
      ).error,
    ).toMatch(/\{\{1\}\} في العنوان/);
  });

  it("guesses sensible sources and previews the message", () => {
    const slots = defaultSlots(CART_TEMPLATE, BINDING_SOURCES.cart);
    expect(slots.map((s) => s.source)).toEqual([
      "customer_name",
      "cart_total",
      "cart_items",
      "checkout_url",
    ]);
    expect(previewText(CART_TEMPLATE, slots, BINDING_SOURCES.cart)).toEqual({
      header: "مرحبًا [اسم العميل]",
      body: "سلتك بقيمة [قيمة السلة] بانتظارك، [عدد المنتجات]",
    });
  });

  it("sends only the part of a link after the button's fixed URL", () => {
    expect(
      urlButtonValue("https://salla.sa/{{1}}", "https://salla.sa/store/c/77"),
    ).toBe("store/c/77");
    expect(urlButtonValue("https://x.com/{{1}}", "abc")).toBe("abc");
  });

  it("builds header, body and button components; named parameters by name", () => {
    const { binding } = resolveBinding(
      { templateId: "111", slots: CART_SLOTS },
      LIBRARY,
      BINDING_SOURCES.cart,
    );
    const { body } = buildBoundMessage(binding, "966500000000", {
      customer_name: "Ahmed",
      cart_total: "SAR 420",
      checkout_url: "https://salla.sa/store/checkout/77",
    });
    expect(body.template).toEqual({
      name: "cart_reminder_ar",
      language: { code: "ar" },
      components: [
        { type: "header", parameters: [{ type: "text", text: "Ahmed" }] },
        {
          type: "body",
          parameters: [
            { type: "text", text: "SAR 420" },
            { type: "text", text: "خصم خاص لك" },
          ],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: "store/checkout/77" }],
        },
      ],
    });

    const named = resolveBinding(
      {
        templateId: "222",
        slots: [
          { part: "body", name: "first_name", source: "customer_name" },
          { part: "body", name: "code", source: "coupon_code" },
        ],
      },
      LIBRARY,
      BINDING_SOURCES.campaign,
    ).binding;
    const message = buildBoundMessage(named, "1", {
      customer_name: "Sara",
      coupon_code: "",
    });
    expect(message.error).toMatch(/\{\{code\}\}/);
    expect(
      buildBoundMessage(named, "1", {
        customer_name: "Sara",
        coupon_code: "X1",
      }).body.template.components,
    ).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", parameter_name: "first_name", text: "Sara" },
          { type: "text", parameter_name: "code", text: "X1" },
        ],
      },
    ]);
  });
});

/** Salla (introspect + cart), Upstash and Meta. */
function mockNetwork(redis = fakeRedis()) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: u, body });
    const json = (status, data) =>
      new Response(JSON.stringify(data), { status });
    if (u.startsWith(KV_URL)) return json(200, { result: redis.run(body) });
    if (u.includes("introspect")) {
      return json(200, { success: true, data: { merchant_id: 1 } });
    }
    if (u.includes("/carts/abandoned/77")) {
      return json(200, {
        success: true,
        data: {
          id: 77,
          status: "active",
          total: { amount: 420, currency: "SAR" },
          checkout_url: "https://salla.sa/store/checkout/77",
          customer: { name: "Ahmed Ali", mobile: "+966560000001" },
          items: [{ quantity: 1 }],
        },
      });
    }
    if (u.includes("graph.facebook.com")) {
      return json(200, { messages: [{ id: "wamid.1" }] });
    }
    return json(404, { success: false });
  });
  const sends = () =>
    calls.filter((c) => c.url.endsWith("/messages")).map((c) => c.body);
  return { calls, redis, sends };
}

const call = (handler, body) =>
  handler(
    new Request("http://localhost/api/x", {
      method: "POST",
      body: JSON.stringify({ token: "tok", appId: "123", ...body }),
    }),
  );

/** A connected account (with an old typed template) and the library. */
function seed(redis) {
  redis.store.set(
    "wa:settings:1",
    JSON.stringify({
      phoneNumberId: "1324055010792496",
      wabaId: "1478536534308215",
      template: "old_typed_template",
      language: "ar",
      params: [],
      token: seal("EAAmerchantTokenValue1234abcd"),
      tokenLast4: "abcd",
      enabled: true,
    }),
  );
  redis.store.set(
    "wa:templates:1",
    JSON.stringify({ syncedAt: "2026-09-30T00:00:00Z", templates: LIBRARY }),
  );
}

const saved = { ...process.env };

describe("features use the template picked from the library", () => {
  beforeEach(() => {
    process.env.KV_REST_API_URL = KV_URL;
    process.env.KV_REST_API_TOKEN = "kv-token";
    process.env.WA_SETTINGS_KEY = randomBytes(32).toString("base64");
    process.env.CRON_SECRET = "cron-secret-value-1234";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  it("saves the cart template and sends reminders with it", async () => {
    const { redis, sends } = mockNetwork();
    seed(redis);
    const bad = await call(whatsapp, {
      action: "binding_save",
      feature: "cart",
      binding: { templateId: "333", slots: [] },
    });
    expect(bad.status).toBe(422);

    const ok = await (
      await call(whatsapp, {
        action: "binding_save",
        feature: "cart",
        binding: { templateId: "111", slots: CART_SLOTS },
      })
    ).json();
    expect(ok.binding.name).toBe("cart_reminder_ar");

    const status = await (await call(whatsapp, { action: "status" })).json();
    expect(status).toMatchObject({
      template: "cart_reminder_ar",
      cartBinding: { templateId: "111" },
    });

    await call(whatsapp, { action: "send", cartId: 77 });
    const [message] = sends();
    expect(message.to).toBe("966560000001");
    expect(message.template.name).toBe("cart_reminder_ar");
    expect(message.template.components.at(-1)).toEqual({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: "store/checkout/77" }],
    });

    // Forgetting it falls back to the old typed template.
    await call(whatsapp, {
      action: "binding_save",
      feature: "cart",
      binding: null,
    });
    await call(whatsapp, { action: "send", cartId: 77 });
    expect(sends().at(-1).template.name).toBe("old_typed_template");
  });

  it("sends a campaign with a template from the library, per customer", async () => {
    const { redis, sends } = mockNetwork();
    seed(redis);
    const res = await call(whatsapp, {
      action: "send_campaign",
      to: "+966500000009",
      customerName: "Sara Ahmed",
      couponCode: "EID20",
      binding: {
        templateId: "222",
        slots: [
          { part: "body", name: "first_name", source: "customer_name" },
          { part: "body", name: "code", source: "coupon_code" },
        ],
      },
    });
    expect((await res.json()).success).toBe(true);
    expect(sends()[0].template).toEqual({
      name: "offer_named",
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", parameter_name: "first_name", text: "Sara" },
            { type: "text", parameter_name: "code", text: "EID20" },
          ],
        },
      ],
    });

    const pending = await call(whatsapp, {
      action: "send_campaign",
      to: "+966500000009",
      binding: { templateId: "333", slots: [] },
    });
    expect(pending.status).toBe(422);
  });

  it("lets replenish run on its picked template, without a typed name", async () => {
    const { redis, sends } = mockNetwork();
    seed(redis);
    await call(whatsapp, {
      action: "binding_save",
      feature: "replenish",
      binding: {
        templateId: "222",
        slots: [
          { part: "body", name: "first_name", source: "customer_name" },
          { part: "body", name: "code", source: "product_name" },
        ],
      },
    });
    const enable = await (
      await call(replenish, {
        action: "settings_save",
        settings: {
          enabled: true,
          template: "",
          language: "ar",
          params: [],
          leadDays: 5,
          dailyLimit: 50,
          couponCode: "",
          consent: true,
        },
      })
    ).json();
    expect(enable.settings.enabled).toBe(true);

    const test = await (
      await call(replenish, { action: "send_test", to: "+201060820691" })
    ).json();
    expect(test.success).toBe(true);
    expect(sends().at(-1).template).toMatchObject({
      name: "offer_named",
      language: { code: "en_US" },
    });
  });
});
