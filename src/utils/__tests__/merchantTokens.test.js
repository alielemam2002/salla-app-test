// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { POST as webhook } from "../../../api/salla-webhook.js";
import { POST as products } from "../../../api/products.js";
import {
  getAccessToken,
  tokenStatus,
} from "../../../api/_lib/merchantTokens.js";
import { fakeRedis } from "../../test/fakeRedis.js";

const KV_URL = "https://kv.example.upstash.io";
const WEBHOOK_SECRET = "webhook-secret";
const DAY = 24 * 60 * 60;
const nowSec = () => Math.floor(Date.now() / 1000);

const authorize = (merchant = 1146761063, overrides = {}) => ({
  event: "app.store.authorize",
  merchant,
  created_at: "2026-09-30 12:31:25",
  data: {
    access_token: "ACCESS-original-111",
    refresh_token: "REFRESH-original-222",
    expires: nowSec() + 14 * DAY,
    scope: "products.read_write carts.read offline_access",
    token_type: "bearer",
    ...overrides,
  },
});

/**
 * Upstash + Salla (introspect answers `merchantId`, the OAuth token
 * endpoint answers `refresh`, the Merchant API echoes the bearer it got).
 */
function mockNetwork({
  merchantId = 1146761063,
  refresh,
  redis = fakeRedis(),
} = {}) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, init });
    const json = (status, data) =>
      new Response(JSON.stringify(data), { status });
    if (u.startsWith(KV_URL)) {
      return json(200, { result: redis.run(JSON.parse(init.body)) });
    }
    if (u.includes("introspect")) {
      return json(200, { success: true, data: { merchant_id: merchantId } });
    }
    if (u === "https://accounts.salla.sa/oauth2/token") {
      const res = refresh?.(new URLSearchParams(String(init.body))) || {
        status: 200,
        body: {
          access_token: "ACCESS-new-333",
          refresh_token: "REFRESH-new-444",
          expires: nowSec() + 14 * DAY,
          token_type: "bearer",
        },
      };
      return json(res.status, res.body);
    }
    if (u.includes("/admin/v2/")) {
      return json(200, {
        success: true,
        data: [{ id: 1, bearer: init.headers?.Authorization }],
        pagination: {},
      });
    }
    return json(404, {});
  });
  const refreshCalls = () =>
    calls.filter((c) => c.url.includes("oauth2/token"));
  const adminCalls = () => calls.filter((c) => c.url.includes("/admin/v2/"));
  return { calls, redis, refreshCalls, adminCalls };
}

function deliver(payload, { sign = true } = {}) {
  const raw = JSON.stringify(payload);
  return webhook(
    new Request("http://localhost/api/salla-webhook", {
      method: "POST",
      body: raw,
      headers: sign
        ? {
            "x-salla-security-strategy": "Signature",
            "x-salla-signature": createHmac("sha256", WEBHOOK_SECRET)
              .update(raw)
              .digest("hex"),
          }
        : {},
    }),
  );
}

const listProducts = () =>
  products(
    new Request("http://localhost/api/products", {
      method: "POST",
      body: JSON.stringify({ token: "tok", appId: "123", action: "list" }),
    }),
  );

const saved = { ...process.env };

describe("Easy Mode tokens", () => {
  beforeEach(() => {
    delete process.env.SALLA_ACCESS_TOKEN;
    process.env.SALLA_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.KV_REST_API_URL = KV_URL;
    process.env.KV_REST_API_TOKEN = "kv-token";
    process.env.WA_SETTINGS_KEY = randomBytes(32).toString("base64");
    process.env.SALLA_CLIENT_ID = "client-id";
    process.env.SALLA_CLIENT_SECRET = "client-secret";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  it("saves a store's tokens from app.store.authorize, encrypted", async () => {
    const { redis } = mockNetwork();
    const res = await deliver(authorize());
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ success: true, handled: true });
    expect(text).not.toContain("ACCESS-original");

    const raw = redis.store.get("salla:tokens:1146761063");
    expect(raw).not.toContain("ACCESS-original-111");
    expect(raw).not.toContain("REFRESH-original-222");
    expect(await tokenStatus("1146761063")).toMatchObject({
      authorized: true,
      offlineAccess: true,
    });
    expect(await getAccessToken("1146761063")).toBe("ACCESS-original-111");
  });

  it("never saves unsigned or malformed token events", async () => {
    const { redis } = mockNetwork();
    expect((await deliver(authorize(), { sign: false })).status).toBe(401);
    const bad = await deliver(authorize(1146761063, { refresh_token: "" }));
    expect(bad.status).toBe(400);
    expect(redis.store.has("salla:tokens:1146761063")).toBe(false);
  });

  it("forgets the tokens when the app is uninstalled", async () => {
    const { redis } = mockNetwork();
    await deliver(authorize());
    await deliver({ event: "app.uninstalled", merchant: 1146761063, data: {} });
    expect(redis.store.has("salla:tokens:1146761063")).toBe(false);
    await expect(getAccessToken("1146761063")).rejects.toMatchObject({
      code: "store_not_authorized",
    });
  });

  it("calls Salla with each store's own token, and refuses stores without one", async () => {
    const redis = fakeRedis();
    mockNetwork({ redis });
    await deliver(authorize());

    const ok = await (await listProducts()).json();
    expect(ok.products[0].bearer).toBe("Bearer ACCESS-original-111");

    // Another store opens the app: it never sent tokens.
    const other = mockNetwork({ merchantId: 2000000002, redis });
    const res = await listProducts();
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("store_not_authorized");
    expect(JSON.stringify(json)).not.toContain("ACCESS-original");
    expect(other.adminCalls()).toEqual([]);
  });

  it("refreshes a day before expiry and saves BOTH new tokens", async () => {
    const { redis, refreshCalls } = mockNetwork();
    await deliver(authorize(1146761063, { expires: nowSec() + 3600 }));

    expect(await getAccessToken("1146761063")).toBe("ACCESS-new-333");
    expect(refreshCalls()).toHaveLength(1);
    const body = new URLSearchParams(String(refreshCalls()[0].init.body));
    expect(Object.fromEntries(body)).toEqual({
      grant_type: "refresh_token",
      refresh_token: "REFRESH-original-222",
      client_id: "client-id",
      client_secret: "client-secret",
    });

    // The new refresh token is what the next refresh would use.
    const raw = redis.store.get("salla:tokens:1146761063");
    expect(raw).not.toContain("REFRESH-new-444");
    expect(await getAccessToken("1146761063")).toBe("ACCESS-new-333");
    expect(refreshCalls()).toHaveLength(1);
    expect(redis.store.has("salla:token-refresh:1146761063")).toBe(false);
  });

  it("never uses a refresh token twice when requests race", async () => {
    const { refreshCalls } = mockNetwork();
    await deliver(authorize(1146761063, { expires: nowSec() + 3600 }));
    const [a, b] = await Promise.all([
      getAccessToken("1146761063"),
      getAccessToken("1146761063"),
    ]);
    expect([a, b]).toEqual(["ACCESS-new-333", "ACCESS-new-333"]);
    expect(refreshCalls()).toHaveLength(1);
  });

  it("asks for a reinstall when Salla rejects the refresh token", async () => {
    const { refreshCalls } = mockNetwork({
      refresh: () => ({ status: 400, body: { error: "invalid_grant" } }),
    });
    await deliver(authorize(1146761063, { expires: nowSec() - 60 }));
    await expect(getAccessToken("1146761063")).rejects.toMatchObject({
      code: "store_not_authorized",
    });
    // Marked revoked: no more refresh attempts with a dead chain.
    await expect(getAccessToken("1146761063")).rejects.toMatchObject({
      code: "store_not_authorized",
    });
    expect(refreshCalls()).toHaveLength(1);
    expect(await tokenStatus("1146761063")).toMatchObject({
      authorized: false,
      revoked: true,
    });
  });

  it("needs the client id and secret to refresh", async () => {
    delete process.env.SALLA_CLIENT_SECRET;
    const { refreshCalls } = mockNetwork();
    await deliver(authorize(1146761063, { expires: nowSec() + 3600 }));
    await expect(getAccessToken("1146761063")).rejects.toMatchObject({
      code: "oauth_not_configured",
    });
    expect(refreshCalls()).toEqual([]);
  });
});
