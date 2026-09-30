// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { GET, POST } from "../../../../api/replenish.js";
import {
  POST as webhook,
  resetStoreCache,
} from "../../../../api/salla-webhook.js";
import { riyadhDay } from "../../../../api/_lib/replenish.js";
import { seal } from "../../../../api/_lib/secretBox.js";
import { fakeRedis } from "../../../test/fakeRedis.js";
import { DAY_MS, reminderDueAt } from "../replenishModel.js";

const KV_URL = "https://kv.example.upstash.io";
const WEBHOOK_SECRET = "webhook-secret";

/** Salla date object for `ms` (store time, +03:00). */
const sallaDate = (ms) => ({
  date: new Date(ms + 3 * 3600e3).toISOString().replace("T", " ").slice(0, 19),
  timezone: "Asia/Riyadh",
});

const order = ({
  id = 5001,
  daysAgo = 0,
  productId = 7,
  quantity = 1,
  customerId = 42,
} = {}) => ({
  event: "order.created",
  merchant: 1,
  data: {
    id,
    reference_id: 90000 + id,
    date: sallaDate(Date.now() - daysAgo * DAY_MS),
    customer: {
      id: customerId,
      first_name: "Ahmed",
      last_name: "Ali",
      mobile: 501806978,
      mobile_code: "+966",
    },
    items: [
      {
        name: "قهوة إثيوبية",
        quantity,
        product: {
          id: productId,
          name: "قهوة إثيوبية",
          url: "https://salla.sa/store/قهوة/p7",
        },
      },
      { name: "كوب", quantity: 1, product: { id: 9, name: "كوب" } },
    ],
  },
});

/** Salla introspect, Upstash, Meta; the store's token is another store's. */
function mockNetwork({ meta, redis = fakeRedis() } = {}) {
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
    // Stock alerts are skipped: the token belongs to another store.
    if (u.endsWith("/store/info")) {
      return json(200, { success: true, data: { id: 999 } });
    }
    if (u.includes("graph.facebook.com")) {
      const res = meta?.({ url: u, body }) || {
        status: 200,
        body: { messages: [{ id: `wamid.${calls.length}` }] },
      };
      return json(res.status, res.body);
    }
    return json(404, { success: false });
  });
  const metaSends = () =>
    calls.filter((c) => c.url.endsWith("/messages")).map((c) => c.body);
  const sallaAdmin = () => calls.filter((c) => c.url.includes("/admin/v2/"));
  return { calls, redis, metaSends, sallaAdmin };
}

function deliver(payload) {
  const raw = JSON.stringify(payload);
  return webhook(
    new Request("http://localhost/api/salla-webhook", {
      method: "POST",
      body: raw,
      headers: {
        "x-salla-security-strategy": "Signature",
        "x-salla-signature": createHmac("sha256", WEBHOOK_SECRET)
          .update(raw)
          .digest("hex"),
      },
    }),
  );
}

const call = (body) =>
  POST(
    new Request("http://localhost/api/replenish", {
      method: "POST",
      body: JSON.stringify({ token: "tok", appId: "123", ...body }),
    }),
  );

const cron = (auth = `Bearer ${process.env.CRON_SECRET}`) =>
  GET(
    new Request("http://localhost/api/replenish", {
      headers: auth ? { authorization: auth } : {},
    }),
  );

const SETTINGS = {
  enabled: true,
  template: "replenish_ar",
  language: "ar",
  params: ["customer_name", "product_name", "product_url"],
  leadDays: 5,
  dailyLimit: 50,
  couponCode: "",
};

/** WhatsApp connected + (optionally) automatic sending on, in Redis. */
function seed(redis, { settings = SETTINGS } = {}) {
  redis.store.set(
    "wa:settings:1",
    JSON.stringify({
      phoneNumberId: "1324055010792496",
      template: "cart_reminder",
      language: "ar",
      params: [],
      token: seal("EAAmerchantTokenValue1234abcd"),
      tokenLast4: "abcd",
      enabled: true,
    }),
  );
  if (settings) {
    redis.store.set(
      "rp:settings:1",
      JSON.stringify({ ...settings, consentAt: "2026-09-01T00:00:00Z" }),
    );
    if (settings.enabled) redis.store.set("rp:merchants", ["1"]);
  }
}

const reminder = (redis, id = "5001:7") =>
  JSON.parse(redis.store.get("rp:items:1")[id]);

const saved = { ...process.env };

describe("when to remind", () => {
  it("counts the cycle per unit bought, minus the lead days", () => {
    const t = 0;
    expect(reminderDueAt(t, 25, 1, 5)).toBe(20 * DAY_MS);
    expect(reminderDueAt(t, 25, 3, 5)).toBe(70 * DAY_MS);
    expect(reminderDueAt(t, 25, 50, 5)).toBe((25 * 6 - 5) * DAY_MS);
    expect(reminderDueAt(t, 3, 1, 7)).toBe(1 * DAY_MS);
  });
});

describe("api/replenish", () => {
  beforeEach(() => {
    resetStoreCache();
    process.env.SALLA_ACCESS_TOKEN = "access";
    process.env.SALLA_WEBHOOK_SECRET = WEBHOOK_SECRET;
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

  it("saves a product's consumption cycle", async () => {
    const { redis } = mockNetwork();
    expect(
      (await call({ action: "cycle_set", productId: 7, days: 400 })).status,
    ).toBe(422);
    await call({ action: "cycle_set", productId: 7, days: 25, name: "قهوة" });
    const json = await (await call({ action: "get" })).json();
    expect(json.cycles["7"]).toMatchObject({ days: 25, name: "قهوة" });
    await call({ action: "cycle_set", productId: 7, days: null });
    expect(redis.store.get("rp:cycles:1")).toEqual({});
  });

  it("schedules a reminder from a new order, once, without calling Salla", async () => {
    const { redis, sallaAdmin } = mockNetwork();
    await call({ action: "cycle_set", productId: 7, days: 25, name: "قهوة" });

    const res = await deliver(order({ quantity: 2 }));
    expect(await res.json()).toMatchObject({ reminders: 1 });
    const r = reminder(redis);
    expect(r).toMatchObject({
      status: "scheduled",
      customerName: "Ahmed",
      mobile: "+966501806978",
      productName: "قهوة إثيوبية",
      productUrl: encodeURI("https://salla.sa/store/قهوة/p7"),
      quantity: 2,
      orderRef: 95001,
    });
    // 2 bags × 25 days, reminded 5 days before.
    const due = Date.parse(r.dueAt) - Date.parse(r.orderedAt);
    expect(due).toBe(45 * DAY_MS);
    // The cup has no cycle.
    expect(Object.keys(redis.store.get("rp:items:1"))).toEqual(["5001:7"]);

    // Salla retries the delivery: no second reminder.
    await deliver(order({ quantity: 2 }));
    expect(redis.store.get("rp:due:1").size).toBe(1);
    expect(sallaAdmin().filter((c) => c.url.includes("/products"))).toEqual([]);
  });

  it("drops the older reminder when the customer buys again", async () => {
    const { redis } = mockNetwork();
    await call({ action: "cycle_set", productId: 7, days: 25 });
    await deliver(order({ id: 5001, daysAgo: 10 }));
    await deliver(order({ id: 5002 }));
    expect(reminder(redis, "5001:7").status).toBe("superseded");
    expect(reminder(redis, "5002:7").status).toBe("scheduled");
    expect([...redis.store.get("rp:due:1").keys()]).toEqual(["5002:7"]);
  });

  it("cancels reminders of a cancelled order", async () => {
    const { redis } = mockNetwork();
    await call({ action: "cycle_set", productId: 7, days: 25 });
    await deliver(order());
    const res = await deliver({
      event: "order.cancelled",
      merchant: 1,
      data: { id: 5001 },
    });
    expect(await res.json()).toMatchObject({ cancelled: 1 });
    expect(reminder(redis).status).toBe("cancelled");
    expect(redis.store.get("rp:due:1").size).toBe(0);
  });

  it("only runs for Vercel's cron secret", async () => {
    mockNetwork();
    expect((await cron(null)).status).toBe(401);
    expect((await cron("Bearer nope")).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await cron("Bearer ")).status).toBe(503);
  });

  it("sends due reminders once a day with the approved template", async () => {
    const { redis, metaSends } = mockNetwork();
    seed(redis);
    await call({ action: "cycle_set", productId: 7, days: 25 });
    await deliver(order({ id: 5001, daysAgo: 30, customerId: 1 })); // due
    await deliver(order({ id: 5002, daysAgo: 1, customerId: 2 })); // not yet

    const res = await (await cron()).json();
    expect(res).toMatchObject({ merchants: 1, results: { 1: { sent: 1 } } });
    expect(metaSends()).toHaveLength(1);
    expect(metaSends()[0]).toMatchObject({
      to: "966501806978",
      type: "template",
      template: {
        name: "replenish_ar",
        language: { code: "ar" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Ahmed" },
              { type: "text", text: "قهوة إثيوبية" },
              {
                type: "text",
                text: encodeURI("https://salla.sa/store/قهوة/p7"),
              },
            ],
          },
        ],
      },
    });
    expect(reminder(redis)).toMatchObject({ status: "sent" });
    expect(reminder(redis, "5002:7").status).toBe("scheduled");
    expect(redis.store.get(`rp:count:1:${riyadhDay()}`)).toBe("1");

    // The next run doesn't send it again.
    await cron();
    expect(metaSends()).toHaveLength(1);
  });

  it("waits a day after Meta's per-customer limit, stops on setup errors", async () => {
    const redis = fakeRedis();
    const { metaSends } = mockNetwork({
      redis,
      meta: () => ({ status: 400, body: { error: { code: 131049 } } }),
    });
    seed(redis);
    await call({ action: "cycle_set", productId: 7, days: 25 });
    await deliver(order({ daysAgo: 30 }));
    await cron();
    expect(metaSends()).toHaveLength(1);
    const r = reminder(redis);
    expect(r).toMatchObject({ status: "scheduled", attempts: 1 });
    expect(Date.parse(r.dueAt)).toBeGreaterThan(Date.now() + DAY_MS - 60e3);

    // Template not approved: stops and keeps the reminder for later.
    redis.store.get("rp:due:1").set("5001:7", 0);
    const next = mockNetwork({
      redis,
      meta: () => ({ status: 400, body: { error: { code: 132001 } } }),
    });
    const run = await (await cron()).json();
    expect(run.results["1"].stopped).toBe("meta_error");
    expect(next.metaSends()).toHaveLength(1);
    expect(reminder(redis).status).toBe("scheduled");
  });

  it("respects the daily limit", async () => {
    const { redis, metaSends } = mockNetwork();
    seed(redis, { settings: { ...SETTINGS, dailyLimit: 25 } });
    await call({ action: "cycle_set", productId: 7, days: 25 });
    await deliver(order({ daysAgo: 30 }));
    redis.store.set(`rp:count:1:${riyadhDay()}`, "25");
    const run = await (await cron()).json();
    expect(run.results["1"].stopped).toBe("daily_limit");
    expect(metaSends()).toHaveLength(0);
  });

  it("needs the opt-in confirmation, WhatsApp and the cron to switch on", async () => {
    const { redis } = mockNetwork();
    const noConsent = await call({
      action: "settings_save",
      settings: SETTINGS,
    });
    expect((await noConsent.json()).code).toBe("consent_required");

    const noWhatsapp = await call({
      action: "settings_save",
      settings: { ...SETTINGS, consent: true },
    });
    expect(noWhatsapp.status).toBe(409);
    expect((await noWhatsapp.json()).error).toMatch(/اربط حساب واتساب/);

    seed(redis, { settings: null });
    delete process.env.CRON_SECRET;
    const noCron = await call({
      action: "settings_save",
      settings: { ...SETTINGS, consent: true },
    });
    expect((await noCron.json()).error).toMatch(/CRON_SECRET/);

    process.env.CRON_SECRET = "cron-secret-value-1234";
    const ok = await (
      await call({
        action: "settings_save",
        settings: { ...SETTINGS, consent: true },
      })
    ).json();
    expect(ok.settings).toMatchObject({
      enabled: true,
      template: "replenish_ar",
    });
    expect(ok.settings.consentAt).toBeTruthy();
    expect(redis.store.get("rp:merchants")).toEqual(["1"]);

    await call({
      action: "settings_save",
      settings: { ...SETTINGS, enabled: false },
    });
    expect(redis.store.get("rp:merchants")).toEqual([]);
  });

  it("sends one reminder now, cancels another, and sends a test", async () => {
    const { redis, metaSends } = mockNetwork();
    seed(redis, { settings: { ...SETTINGS, enabled: false } });
    await call({ action: "cycle_set", productId: 7, days: 25 });
    await deliver(order({ id: 5001, customerId: 1 }));
    await deliver(order({ id: 5002, customerId: 2 }));

    const now = await (
      await call({ action: "send_now", reminderId: "5001:7" })
    ).json();
    expect(now.success).toBe(true);
    expect(reminder(redis, "5001:7").status).toBe("sent");

    await call({ action: "cancel", reminderId: "5002:7" });
    expect(reminder(redis, "5002:7").status).toBe("cancelled");
    expect(
      (await call({ action: "send_now", reminderId: "5002:7" })).status,
    ).toBe(422);

    const test = await (
      await call({ action: "send_test", to: "+201060820691" })
    ).json();
    expect(test.success).toBe(true);
    expect(metaSends().at(-1)).toMatchObject({
      to: "201060820691",
      template: { name: "replenish_ar" },
    });
  });
});
