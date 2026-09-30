// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  POST as webhook,
  resetStoreCache,
} from "../../../../api/salla-webhook.js";
import { POST as alertsApi } from "../../../../api/stock-alerts.js";
import { stockLevel } from "../stockModel.js";
import { fakeRedis } from "../../../test/fakeRedis.js";

const KV_URL = "https://kv.example.upstash.io";
const SECRET = "webhook-secret-value";

/** Salla (introspect, store info, products) + Upstash; records calls. */
function mockNetwork({
  merchantId = 1,
  storeId = merchantId,
  products = {},
  list = null,
  failProduct = false,
  redis = fakeRedis(),
} = {}) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push(u);
    const json = (status, data) =>
      new Response(JSON.stringify(data), { status });
    if (u.startsWith(KV_URL)) return json(200, { result: redis.run(body) });
    if (u.includes("introspect")) {
      return json(200, { success: true, data: { merchant_id: merchantId } });
    }
    if (u.endsWith("/store/info")) {
      return json(200, { success: true, data: { id: storeId } });
    }
    const one = u.match(/\/products\/(\d+)$/);
    if (one) {
      if (failProduct) return json(500, { success: false });
      const product = products[one[1]];
      return product
        ? json(200, { success: true, data: product })
        : json(404, { success: false });
    }
    if (u.includes("/products?")) {
      const page = Number(new URL(u).searchParams.get("page"));
      const pages = list || [[]];
      return json(200, {
        success: true,
        data: pages[page - 1] || [],
        pagination: { currentPage: page, totalPages: pages.length },
      });
    }
    return json(404, { success: false });
  });
  const sallaCalls = () => calls.filter((u) => u.includes("salla.dev/admin"));
  return { calls, redis, sallaCalls };
}

const PRODUCTS = {
  7: { id: 7, name: "بيتزا", sku: "PZ-1", quantity: 0, status: "sale" },
  8: { id: 8, name: "برجر", sku: "BG-1", quantity: 3, status: "sale" },
  9: { id: 9, name: "عصير", sku: "JC-1", quantity: 40, status: "sale" },
  10: { id: 10, name: "كود", unlimited_quantity: true, quantity: 0 },
};

const ORDER = {
  event: "order.created",
  merchant: 1,
  created_at: "2026-09-30 12:00:00",
  data: {
    id: 2116149737,
    reference_id: 41027662,
    customer: { first_name: "Mohammed", last_name: "Ali", mobile: 501806978 },
    items: [
      { id: 1, name: "بيتزا", sku: "PZ-1", quantity: 2, product: { id: 7 } },
      { id: 2, name: "برجر", sku: "BG-1", quantity: 1, product: { id: 8 } },
      { id: 3, name: "عصير", sku: "JC-1", quantity: 1, product: { id: 9 } },
      { id: 4, name: "كود", sku: "CD-1", quantity: 1, product: { id: 10 } },
    ],
  },
};

const sign = (raw, secret = SECRET) =>
  createHmac("sha256", secret).update(raw).digest("hex");

function deliver(payload, { headers, secret } = {}) {
  const raw = JSON.stringify(payload);
  return webhook(
    new Request("http://localhost/api/salla-webhook", {
      method: "POST",
      body: raw,
      headers: headers || {
        "x-salla-security-strategy": "Signature",
        "x-salla-signature": sign(raw, secret),
      },
    }),
  );
}

const call = (body) =>
  alertsApi(
    new Request("http://localhost/api/stock-alerts", {
      method: "POST",
      body: JSON.stringify({ token: "tok", appId: "123", ...body }),
    }),
  );

const saved = { ...process.env };

describe("stock levels", () => {
  it("tells out of stock from running low, and ignores unlimited stock", () => {
    expect(stockLevel({ quantity: 0 }, 5)).toBe("out");
    expect(stockLevel({ quantity: 12, status: "out" }, 5)).toBe("out");
    expect(stockLevel({ quantity: 5 }, 5)).toBe("low");
    expect(stockLevel({ quantity: 6 }, 5)).toBeNull();
    expect(stockLevel({ quantity: 1 }, 0)).toBeNull();
    expect(stockLevel({ quantity: 0, unlimited_quantity: true }, 5)).toBeNull();
    // A product without a tracked quantity isn't "0 left".
    expect(stockLevel({ quantity: null, status: "sale" }, 5)).toBeNull();
  });
});

describe("api/salla-webhook", () => {
  beforeEach(() => {
    resetStoreCache();
    process.env.SALLA_ACCESS_TOKEN = "access";
    process.env.KV_REST_API_URL = KV_URL;
    process.env.KV_REST_API_TOKEN = "kv-token";
    process.env.SALLA_WEBHOOK_SECRET = SECRET;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("refuses deliveries it can't verify", async () => {
    const { sallaCalls } = mockNetwork({ products: PRODUCTS });
    expect((await deliver(ORDER, { secret: "wrong" })).status).toBe(401);
    expect((await deliver(ORDER, { headers: {} })).status).toBe(401);
    delete process.env.SALLA_WEBHOOK_SECRET;
    expect((await deliver(ORDER)).status).toBe(503);
    expect(sallaCalls()).toHaveLength(0);
  });

  it("accepts the Token strategy", async () => {
    mockNetwork({ products: PRODUCTS });
    const res = await deliver(ORDER, {
      headers: {
        "x-salla-security-strategy": "Token",
        authorization: SECRET,
      },
    });
    expect(await res.json()).toMatchObject({ handled: true, alerts: 2 });
  });

  it("alerts for ordered products that ran out or are running low", async () => {
    const { redis } = mockNetwork({ products: PRODUCTS });
    const res = await deliver(ORDER);
    expect(await res.json()).toEqual({
      success: true,
      handled: true,
      alerts: 2,
      reminders: 0,
    });

    const alerts = redis.store.get("alerts:1").map((a) => JSON.parse(a));
    expect(alerts).toEqual([
      expect.objectContaining({
        kind: "out",
        orderRef: 41027662,
        customer: "Mohammed Ali",
        productId: "7",
        productName: "بيتزا",
        ordered: 2,
        quantity: 0,
      }),
      expect.objectContaining({ kind: "low", productId: "8", quantity: 3 }),
    ]);

    // Salla retries a delivery: the order is handled once.
    expect(await (await deliver(ORDER)).json()).toMatchObject({ alerts: 0 });
    expect(redis.store.get("alerts:1")).toHaveLength(2);
  });

  it("ignores other events without reading anything", async () => {
    const { sallaCalls } = mockNetwork({ products: PRODUCTS });
    const res = await deliver({
      event: "app.store.authorize",
      merchant: 1,
      data: { access_token: "secret-token" },
    });
    expect(await res.json()).toEqual({ success: true, handled: false });
    expect(sallaCalls()).toHaveLength(0);
  });

  it("doesn't read another store's products with this store's token", async () => {
    const { sallaCalls } = mockNetwork({ storeId: 999, products: PRODUCTS });
    const res = await deliver(ORDER);
    expect(await res.json()).toMatchObject({
      handled: false,
      reason: "other_store",
    });
    expect(sallaCalls().filter((u) => u.includes("/products"))).toHaveLength(0);
  });

  it("asks Salla to retry when it can't read a product", async () => {
    const redis = fakeRedis();
    mockNetwork({ products: PRODUCTS, failProduct: true, redis });
    expect((await deliver(ORDER)).status).toBe(500);
    mockNetwork({ products: PRODUCTS, redis });
    expect(await (await deliver(ORDER)).json()).toMatchObject({ alerts: 2 });
  });

  it("uses the merchant's threshold", async () => {
    const { redis } = mockNetwork({ products: PRODUCTS });
    redis.store.set("alerts:settings:1", JSON.stringify({ threshold: 0 }));
    expect(await (await deliver(ORDER)).json()).toMatchObject({ alerts: 1 });
  });
});

describe("api/stock-alerts", () => {
  beforeEach(() => {
    process.env.SALLA_ACCESS_TOKEN = "access";
    process.env.KV_REST_API_URL = KV_URL;
    process.env.KV_REST_API_TOKEN = "kv-token";
    process.env.SALLA_WEBHOOK_SECRET = SECRET;
    resetStoreCache();
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("lists order alerts with unread ones, and marks them read", async () => {
    mockNetwork({ products: PRODUCTS });
    await deliver(ORDER);
    const overview = await (await call({ action: "overview" })).json();
    expect(overview).toMatchObject({
      setup: { storage: true, webhookSecret: true },
      settings: { threshold: 5 },
      unread: 2,
      lastOrder: { orderId: "2116149737" },
    });
    expect(overview.alerts[0]).toMatchObject({ kind: "out", unread: true });

    await call({ action: "mark_read" });
    const after = await (await call({ action: "overview" })).json();
    expect(after.unread).toBe(0);
    expect(after.alerts[0].unread).toBe(false);

    await call({ action: "clear" });
    expect((await (await call({ action: "overview" })).json()).alerts).toEqual(
      [],
    );
  });

  it("only saves thresholds it offers", async () => {
    mockNetwork();
    expect((await call({ action: "settings_save", threshold: 7 })).status).toBe(
      422,
    );
    const ok = await (
      await call({ action: "settings_save", threshold: 10 })
    ).json();
    expect(ok.settings).toEqual({ threshold: 10 });
  });

  it("scans every page of products for low and out-of-stock ones", async () => {
    mockNetwork({
      list: [
        [PRODUCTS[7], PRODUCTS[9]],
        [PRODUCTS[8], PRODUCTS[10], { ...PRODUCTS[9], id: 11, quantity: 1 }],
      ],
    });
    const json = await (await call({ action: "stock" })).json();
    expect(json).toMatchObject({ threshold: 5, scanned: 5, truncated: false });
    expect(json.out.map((p) => p.id)).toEqual([7]);
    expect(json.low.map((p) => [p.id, p.quantity])).toEqual([
      [11, 1],
      [8, 3],
    ]);
  });
});
