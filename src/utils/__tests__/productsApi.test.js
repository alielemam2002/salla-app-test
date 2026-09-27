import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchProductsPage, fetchAllProducts } from "../productsApi.js";

vi.mock("../constants.js", () => ({
  PRODUCTS_FUNCTION_URL: "/api/products",
  getAppId: vi.fn(() => "test-app-id"),
}));

const jsonResponse = (body, status = 200) => ({
  status,
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

describe("productsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts token, app id and paging to the products function", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true, products: [] }));

    await fetchProductsPage("tok", { page: 2, perPage: 10 });

    expect(fetch).toHaveBeenCalledWith("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "tok",
        appId: "test-app-id",
        page: 2,
        perPage: 10,
      }),
    });
  });

  it("returns an error result for non-JSON responses", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 500,
      text: vi.fn().mockResolvedValue("<!DOCTYPE html>"),
    });

    const result = await fetchProductsPage("tok");
    expect(result).toMatchObject({ success: false, code: "bad_response" });
  });

  it("returns an error result when fetch throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("offline"));

    const result = await fetchProductsPage("tok");
    expect(result).toEqual({
      success: false,
      code: "network_error",
      error: "offline",
    });
  });

  it("fetches every page sequentially and reports progress", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          products: [{ id: 1 }],
          pagination: { totalPages: 2, total: 2 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          products: [{ id: 2 }],
          pagination: { totalPages: 2, total: 2 },
        }),
      );
    const onProgress = vi.fn();

    const result = await fetchAllProducts("tok", { onProgress });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.products).toEqual([{ id: 1 }, { id: 2 }]);
    expect(onProgress).toHaveBeenLastCalledWith({
      page: 2,
      totalPages: 2,
      loaded: 2,
    });
  });

  it("stops and returns the error when a page fails", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          products: [{ id: 1 }],
          pagination: { totalPages: 3 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ success: false, code: "salla_api_error", error: "x" }),
      );

    const result = await fetchAllProducts("tok");

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      success: false,
      code: "salla_api_error",
      products: [{ id: 1 }],
    });
  });
});
