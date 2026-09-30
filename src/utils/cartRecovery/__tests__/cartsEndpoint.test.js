// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../../../api/carts.js";

// Easy Mode: each store's OAuth token comes from storage (app.store.authorize).
// Here store 999 never authorized the app; every other store has "access".
vi.mock("../../../../api/_lib/merchantTokens.js", async (importOriginal) => ({
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

/** Respond by URL so parallel product lookups get the right answer. */
function mockFetch(routes) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url) => {
    const u = String(url);
    calls.push(u);
    const key = Object.keys(routes).find((k) => u.includes(k));
    const res = routes[key] || { status: 404, body: { success: false } };
    return new Response(JSON.stringify(res.body), { status: res.status });
  });
  return calls;
}

const call = (body) =>
  POST(
    new Request("http://localhost/api/carts", {
      method: "POST",
      body: JSON.stringify({ token: "tok", appId: "123", ...body }),
    }),
  );

describe("api/carts", () => {
  beforeEach(() => {
    process.env.SALLA_ACCESS_TOKEN = "access";
  });

  it("lists abandoned carts 60 per page", async () => {
    const calls = mockFetch({
      introspect: INTROSPECT_OK,
      "/carts/abandoned": {
        status: 200,
        body: {
          success: true,
          data: [{ id: 5 }],
          pagination: { count: 1, current: 2, next: null },
        },
      },
    });
    const res = await call({ action: "list", page: 2 });
    expect(await res.json()).toEqual({
      success: true,
      carts: [{ id: 5 }],
      pagination: { count: 1, current: 2, next: null },
    });
    expect(calls[1]).toBe(
      "https://api.salla.dev/admin/v2/carts/abandoned?page=2&per_page=60",
    );
  });

  it("returns a cart with product names looked up from Salla", async () => {
    const calls = mockFetch({
      introspect: INTROSPECT_OK,
      "/carts/abandoned/77": {
        status: 200,
        body: {
          success: true,
          data: {
            id: 77,
            status: "active",
            items: [
              { id: 1, product_id: 10, quantity: 2 },
              { id: 2, product_id: 11, quantity: 1 },
              { id: 3, product_id: 10, quantity: 1 },
            ],
          },
        },
      },
      "/products/10": {
        status: 200,
        body: { success: true, data: { name: "Shirt", thumbnail: "t.jpg" } },
      },
      "/products/11": { status: 404, body: { success: false } },
    });
    const res = await call({ action: "get", cartId: 77 });
    const json = await res.json();
    expect(json.cart.id).toBe(77);
    expect(json.products).toEqual({
      10: { name: "Shirt", thumbnail: "t.jpg" },
    });
    // Each product is looked up once.
    expect(calls.filter((u) => u.includes("/products/10"))).toHaveLength(1);
  });

  it("rejects bad cart ids before calling Salla", async () => {
    const calls = mockFetch({ introspect: INTROSPECT_OK });
    const res = await call({ action: "get", cartId: "../orders" });
    expect(res.status).toBe(400);
    expect(calls.some((u) => u.includes("/carts/"))).toBe(false);
  });

  it("reports a missing carts.read scope", async () => {
    mockFetch({
      introspect: INTROSPECT_OK,
      "/carts/abandoned": {
        status: 401,
        body: {
          success: false,
          error: {
            message:
              "The access token should have access to one of those scopes: carts.read",
          },
        },
      },
    });
    const res = await call({ action: "list" });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("missing_scope");
  });
});
