// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import {
  POST as customersPost,
  customerMobile,
  pickCustomer,
} from "../../../../api/customers.js";
import { POST as whatsappPost } from "../../../../api/whatsapp.js";
import { cleanParam } from "../../../../api/_lib/whatsappGraph.js";

const KV_URL = "https://kv.example.upstash.io";

function mockNetwork({ routes = {}, meta } = {}) {
  const kv = new Map();
  const calls = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: u, body, headers: init.headers || {} });
    const json = (status, data) =>
      new Response(JSON.stringify(data), { status });
    if (u.includes("introspect")) {
      return json(200, { success: true, data: { merchant_id: 1 } });
    }
    if (u.startsWith(KV_URL)) {
      const [cmd, key, value] = body;
      if (cmd === "SET") kv.set(key, value);
      return json(200, {
        result: cmd === "GET" ? (kv.get(key) ?? null) : "OK",
      });
    }
    if (u.includes("graph.facebook.com")) {
      const res = meta?.(u, body) || {
        status: 200,
        body: u.endsWith("/messages")
          ? { messages: [{ id: "wamid.C", message_status: "accepted" }] }
          : { display_phone_number: "1555", verified_name: "Store" },
      };
      return json(res.status, res.body);
    }
    const key = Object.keys(routes).find((k) => u.includes(k));
    if (key) return json(routes[key].status || 200, routes[key].body);
    return json(404, { success: false });
  });
  return { calls, kv };
}

const post = (handler, body) =>
  handler(
    new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ token: "tok", appId: "123", ...body }),
    }),
  );

const saved = { ...process.env };
beforeEach(() => {
  process.env.SALLA_ACCESS_TOKEN = "access";
  process.env.KV_REST_API_URL = KV_URL;
  process.env.KV_REST_API_TOKEN = "kv";
  process.env.WA_SETTINGS_KEY = randomBytes(32).toString("base64");
});
afterEach(() => {
  process.env = { ...saved };
});

describe("api/customers", () => {
  it("builds full international numbers from Salla's mobile + code", () => {
    expect(customerMobile(1060820691, "+20")).toBe("+201060820691");
    expect(customerMobile("0560000000", "966")).toBe("+966560000000");
    expect(customerMobile("966560000000", "+966")).toBe("+966560000000");
    expect(customerMobile("560000000", "")).toBe("");
    expect(customerMobile("", "+966")).toBe("");
  });

  it("lists customers with only what a campaign needs", async () => {
    const { calls } = mockNetwork({
      routes: {
        "/customers?": {
          body: {
            success: true,
            data: [
              {
                id: 5,
                first_name: "Sara",
                last_name: "Ali",
                mobile: 560000000,
                mobile_code: "+966",
                email: "sara@example.com",
                city: "Riyadh",
                groups: [3],
                is_blocked: false,
                is_notifications_enabled: false,
              },
            ],
            pagination: { next: null },
          },
        },
      },
    });
    const json = await (
      await post(customersPost, { action: "list", page: 2 })
    ).json();
    expect(json.customers).toEqual([
      {
        id: 5,
        name: "Sara Ali",
        firstName: "Sara",
        mobile: "+966560000000",
        city: "Riyadh",
        groups: [3],
        isBlocked: false,
        notificationsEnabled: false,
      },
    ]);
    // Email isn't needed, so it isn't sent to the browser.
    expect(JSON.stringify(json)).not.toContain("sara@example.com");
    const url = decodeURIComponent(
      calls.find((c) => c.url.includes("/customers?")).url,
    );
    expect(url).toContain("page=2");
    expect(url).toContain("fields[]=is_blocked");
    expect(url).toContain("fields[]=is_notifications_enabled");
  });

  it("lists customer groups", async () => {
    mockNetwork({
      routes: {
        "/customers/groups": {
          body: {
            success: true,
            data: [{ id: 3, name: "VIP", conditions: [] }],
          },
        },
      },
    });
    const json = await (await post(customersPost, { action: "groups" })).json();
    expect(json.groups).toEqual([{ id: 3, name: "VIP" }]);
  });

  it("maps pickCustomer defensively", () => {
    expect(pickCustomer({ id: 1 })).toMatchObject({
      name: "",
      mobile: "",
      groups: [],
      isBlocked: false,
    });
  });
});

describe("api/whatsapp send_campaign", () => {
  const CAMPAIGN = {
    template: "offer_ar",
    language: "ar",
    params: [
      { source: "customer_name" },
      { source: "custom", value: "خصم 20%\non everything" },
      { source: "coupon_code", value: "SAVE20" },
    ],
  };

  const connect = () =>
    post(whatsappPost, {
      action: "settings_save",
      settings: {
        phoneNumberId: "1324055010792496",
        accessToken: "EAAmerchantTokenValue1234abcd",
        template: "cart_reminder_ar",
        language: "ar",
        params: [],
      },
    });

  it("sends the campaign's template with each customer's name", async () => {
    const { calls } = mockNetwork();
    await connect();
    const res = await post(whatsappPost, {
      action: "send_campaign",
      to: "+966560000000",
      customerName: "Sara Ali",
      ...CAMPAIGN,
    });
    expect(await res.json()).toMatchObject({
      success: true,
      messageId: "wamid.C",
    });
    const send = calls.find((c) => c.url.endsWith("/messages"));
    expect(send.body.to).toBe("966560000000");
    // The campaign's template, not the cart reminder saved in settings.
    expect(send.body.template).toEqual({
      name: "offer_ar",
      language: { code: "ar" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "Sara" },
            { type: "text", text: "خصم 20% on everything" },
            { type: "text", text: "SAVE20" },
          ],
        },
      ],
    });
  });

  it("respects the switch and needs a connected account", async () => {
    mockNetwork();
    const before = await post(whatsappPost, {
      action: "send_campaign",
      to: "+966560000000",
      ...CAMPAIGN,
    });
    expect(before.status).toBe(503);

    const { calls } = mockNetwork();
    await connect();
    await post(whatsappPost, { action: "settings_enable", enabled: false });
    const off = await post(whatsappPost, {
      action: "send_campaign",
      to: "+966560000000",
      ...CAMPAIGN,
    });
    expect(off.status).toBe(403);
    expect(calls.some((c) => c.url.endsWith("/messages"))).toBe(false);
  });

  it("rejects bad campaigns before calling Meta", async () => {
    const { calls } = mockNetwork();
    await connect();
    const cases = [
      { ...CAMPAIGN, template: "Offer AR" },
      { ...CAMPAIGN, params: [{ source: "custom", value: "  " }] },
      { ...CAMPAIGN, params: [{ source: "email" }] },
    ];
    for (const campaign of cases) {
      const res = await post(whatsappPost, {
        action: "send_campaign",
        to: "+966560000000",
        ...campaign,
      });
      expect(res.status).toBe(422);
    }
    const noNumber = await post(whatsappPost, {
      action: "send_campaign",
      to: "0560000000",
      ...CAMPAIGN,
    });
    expect(noNumber.status).toBe(422);
    expect(calls.some((c) => c.url.endsWith("/messages"))).toBe(false);
  });

  it("cleans parameters the way Meta requires", () => {
    expect(cleanParam("a\n\tb     c ")).toBe("a b   c");
    expect(cleanParam("x".repeat(2000))).toHaveLength(1000);
  });
});
