// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST, buildCouponPayload } from "../../../../api/coupons.js";

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

/** Queue fetch responses in call order and record requests. */
function mockFetch(responses) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    calls.push({
      url: String(url),
      method: init.method || "GET",
      body: init.body,
    });
    const next = responses[calls.length - 1] || responses[responses.length - 1];
    return new Response(JSON.stringify(next.body), { status: next.status });
  });
  return calls;
}

const call = (body) =>
  POST(
    new Request("http://localhost/api/coupons", {
      method: "POST",
      body: JSON.stringify({ token: "tok", appId: "123", ...body }),
    }),
  );

const validInput = {
  code: "SUMMER20",
  type: "percentage",
  amount: 20,
  maximum_amount: 50,
  expiry_date: "2026-06-10 23:59:00",
  free_shipping: false,
  exclude_sale_products: false,
  status: "active",
};

describe("api/coupons", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    process.env.SALLA_ACCESS_TOKEN = "access";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.SALLA_ACCESS_TOKEN;
    vi.restoreAllMocks();
  });

  it("builds a storewide payload from the allow-list only", () => {
    const { payload } = buildCouponPayload({
      ...validInput,
      products_include: ["1"],
      list_include_categories: ["2"],
    });
    expect(payload).toEqual({
      code: "SUMMER20",
      type: "percentage",
      amount: 20,
      maximum_amount: 50,
      expiry_date: "2026-06-10 23:59:00",
      free_shipping: false,
      exclude_sale_products: false,
      applied_in: "all",
      status: "active",
    });
  });

  it("rejects invalid input before calling Salla", async () => {
    const calls = mockFetch([INTROSPECT_OK]);
    const res = await call({
      action: "create",
      coupon: { code: "", type: "percentage" },
    });
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(Object.keys(json.fields)).toEqual(
      expect.arrayContaining([
        "code",
        "amount",
        "maximum_amount",
        "expiry_date",
      ]),
    );
    expect(calls).toHaveLength(1); // introspect only
  });

  it("lists coupons with page and keyword", async () => {
    const calls = mockFetch([
      INTROSPECT_OK,
      {
        status: 200,
        body: {
          success: true,
          data: [{ id: 1 }],
          pagination: { totalPages: 1 },
        },
      },
    ]);
    const json = await (
      await call({ action: "list", page: 2, keyword: "SUM" })
    ).json();
    expect(json).toMatchObject({ success: true, coupons: [{ id: 1 }] });
    expect(calls[1].url).toBe(
      "https://api.salla.dev/admin/v2/coupons?page=2&keyword=SUM",
    );
  });

  it("creates with POST and updates with PUT", async () => {
    const calls = mockFetch([
      INTROSPECT_OK,
      { status: 201, body: { success: true, data: { id: 9 } } },
    ]);
    const created = await call({ action: "create", coupon: validInput });
    expect(created.status).toBe(201);
    expect(calls[1]).toMatchObject({
      url: "https://api.salla.dev/admin/v2/coupons",
      method: "POST",
    });

    const calls2 = mockFetch([
      INTROSPECT_OK,
      { status: 200, body: { success: true, data: { id: 9 } } },
    ]);
    await call({ action: "update", couponId: 9, coupon: validInput });
    expect(calls2[1]).toMatchObject({
      url: "https://api.salla.dev/admin/v2/coupons/9",
      method: "PUT",
    });
  });

  it("passes Salla's status, message and field errors through", async () => {
    mockFetch([
      INTROSPECT_OK,
      {
        status: 422,
        body: {
          success: false,
          error: {
            message: "alert.invalid_fields",
            fields: { code: ["duplicate"] },
          },
        },
      },
    ]);
    const res = await call({ action: "create", coupon: validInput });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      code: "salla_api_error",
      fields: { code: ["duplicate"] },
    });
  });

  it("maps a missing scope to 403 missing_scope", async () => {
    mockFetch([
      INTROSPECT_OK,
      {
        status: 401,
        body: {
          success: false,
          error: {
            message:
              "The access token should have access to one of those scopes: marketing.read_write",
          },
        },
      },
    ]);
    const res = await call({ action: "delete", couponId: 9 });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("missing_scope");
  });

  it("returns session_invalid when introspection fails", async () => {
    mockFetch([
      {
        status: 401,
        body: { success: false, error: { message: "Decryption failed" } },
      },
    ]);
    const res = await call({ action: "list" });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("session_invalid");
  });
});
