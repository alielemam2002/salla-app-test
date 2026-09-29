// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../../../api/products.js";

const INTROSPECT_OK = {
  status: 200,
  body: { success: true, data: { merchant_id: 1, user_id: 2 } },
};

function mockFetch(responses) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    calls.push({
      url: String(url),
      method: init.method || "GET",
      body: init.body ? JSON.parse(init.body) : undefined,
    });
    const next = responses[calls.length - 1] || responses[responses.length - 1];
    return new Response(JSON.stringify(next.body), { status: next.status });
  });
  return calls;
}

const call = (body) =>
  POST(
    new Request("http://localhost/api/products", {
      method: "POST",
      body: JSON.stringify({ token: "tok", appId: "123", ...body }),
    }),
  );

const PRICING = {
  action_name: "pricing",
  value: {
    column: "sale_price",
    formula: "price - (price * amount /100 )",
    amount: 20,
    apply_on: "product",
  },
};

describe("api/products bulk_actions", () => {
  beforeEach(() => {
    process.env.SALLA_ACCESS_TOKEN = "access";
  });

  it("forwards a documented operation to POST /products/actions", async () => {
    const operations = [
      { operation_id: "op-1", action_name: "pricing", status: "in_progress" },
    ];
    const calls = mockFetch([
      INTROSPECT_OK,
      { status: 200, body: { status: 200, success: true, data: operations } },
    ]);
    const res = await call({
      action: "bulk_actions",
      operations: [PRICING],
      filters: {
        select_all: true,
        unselected_ids: ["9"],
        ids: [],
        categories: ["77"],
        brands: [],
        status: ["sale"],
        types: [],
      },
    });

    expect(await res.json()).toEqual({ success: true, operations });
    expect(calls[1]).toMatchObject({
      url: "https://api.salla.dev/admin/v2/products/actions",
      method: "POST",
    });
    expect(calls[1].body).toEqual({
      operations: [PRICING],
      filters: {
        select_all: true,
        unselected_ids: ["9"],
        ids: [],
        categories: ["77"],
        brands: [],
        status: ["sale"],
        types: [],
      },
    });
  });

  it("refuses undocumented actions and formulas before calling Salla", async () => {
    const calls = mockFetch([INTROSPECT_OK]);
    const filters = { ids: [1] };
    const bad = [
      { action_name: "delete" },
      { ...PRICING, value: { ...PRICING.value, formula: "price * 0" } },
    ];
    for (const op of bad) {
      const res = await call({
        action: "bulk_actions",
        operations: [op],
        filters,
      });
      expect(res.status).toBe(422);
    }
    const noTarget = await call({
      action: "bulk_actions",
      operations: [PRICING],
      filters: { ids: [] },
    });
    expect(noTarget.status).toBe(422);
    // Only the introspect calls reached the network.
    expect(calls.every((c) => c.url.includes("introspect"))).toBe(true);
  });

  it("passes Salla's validation error through with its fields", async () => {
    mockFetch([
      INTROSPECT_OK,
      {
        status: 422,
        body: {
          success: false,
          error: {
            message: "alert.invalid_fields",
            fields: { "operations.0.action_name": ["invalid"] },
          },
        },
      },
    ]);
    const res = await call({
      action: "bulk_actions",
      operations: [{ action_name: "duplicate" }],
      filters: { ids: [5] },
    });
    expect(res.status).toBe(422);
    expect((await res.json()).fields).toEqual({
      "operations.0.action_name": ["invalid"],
    });
  });

  it("loads product tags with the taxonomies", async () => {
    const calls = mockFetch([
      INTROSPECT_OK,
      { status: 200, body: { success: true, data: [{ id: 1, name: "Cat" }] } },
      {
        status: 200,
        body: { success: true, data: [{ id: 2, name: "Brand" }] },
      },
      { status: 200, body: { success: true, data: [{ id: 3, name: "Tag" }] } },
    ]);
    const res = await call({ action: "taxonomies" });
    expect((await res.json()).tags).toEqual([{ id: 3, name: "Tag" }]);
    expect(calls[3].url).toBe("https://api.salla.dev/admin/v2/products/tags");
  });
});
