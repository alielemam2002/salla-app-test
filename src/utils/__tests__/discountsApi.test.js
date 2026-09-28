import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateDiscountedPrice,
  getProductRegularPrice,
  prepareBulkDiscountPayload,
  prepareRemoveDiscountPayload,
  bulkUpdateProductPrices,
} from "../discountsApi.js";
import { PRODUCTS_FUNCTION_URL } from "../constants.js";

describe("discountsApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getProductRegularPrice", () => {
    it("prioritizes regular_price over sale-discounted price", () => {
      // In Salla, an on-sale product has regular_price = 150, and price = 100
      const onSaleProduct = {
        id: 1,
        regular_price: { amount: 150, currency: "SAR" },
        price: { amount: 100, currency: "SAR" },
        sale_price: { amount: 100, currency: "SAR" },
      };
      expect(getProductRegularPrice(onSaleProduct)).toBe(150);
    });

    it("falls back to price if regular_price is not present", () => {
      const normalProduct = {
        id: 2,
        price: { amount: 200, currency: "SAR" },
      };
      expect(getProductRegularPrice(normalProduct)).toBe(200);
    });

    it("handles number types", () => {
      expect(getProductRegularPrice({ regular_price: 300, price: 250 })).toBe(300);
      expect(getProductRegularPrice({ price: 250 })).toBe(250);
    });
  });

  describe("calculateDiscountedPrice", () => {
    it("calculates percentage discount accurately", () => {
      // 100 SAR with 20% discount = 80 SAR
      expect(calculateDiscountedPrice(100, "percentage", 20)).toBe(80);
      // 250 SAR with 15% discount = 212.5 SAR
      expect(calculateDiscountedPrice(250, "percentage", 15)).toBe(212.5);
      // 99.99 SAR with 10% discount = 89.99 SAR (rounded to 2 decimals)
      expect(calculateDiscountedPrice(99.99, "percentage", 10)).toBe(89.99);
    });

    it("calculates fixed amount discount accurately", () => {
      // 100 SAR minus 20 SAR = 80 SAR
      expect(calculateDiscountedPrice(100, "fixed", 20)).toBe(80);
      // 55.5 SAR minus 10.5 SAR = 45 SAR
      expect(calculateDiscountedPrice(55.5, "fixed", 10.5)).toBe(45);
    });

    it("prevents negative sale prices", () => {
      // 50 SAR with 100 SAR fixed discount clamps to 0
      expect(calculateDiscountedPrice(50, "fixed", 100)).toBe(0);
      // 100 SAR with 120% discount clamps to 0
      expect(calculateDiscountedPrice(100, "percentage", 120)).toBe(0);
    });

    it("returns original price for invalid inputs", () => {
      expect(calculateDiscountedPrice(0, "percentage", 20)).toBe(0);
      expect(calculateDiscountedPrice(-10, "percentage", 20)).toBe(-10);
      expect(calculateDiscountedPrice(100, "percentage", 0)).toBe(100);
      expect(calculateDiscountedPrice(100, "percentage", -5)).toBe(100);
      expect(calculateDiscountedPrice("invalid", "percentage", 10)).toBeNaN();
    });
  });

  describe("prepareBulkDiscountPayload", () => {
    const mockProducts = [
      { id: 101, name: "Product A", price: 100 },
      { id: 102, name: "Product B", price: { amount: 200, currency: "SAR" } },
      { id: 103, name: "Freebie", price: 0 }, // Should be excluded
      { id: 104, name: "Invalid", price: "none" }, // Should be excluded
    ];

    it("prepares Salla bulkPrice payload with percentage discount", () => {
      const payload = prepareBulkDiscountPayload(mockProducts, {
        discountType: "percentage",
        discountValue: 20,
      });

      expect(payload).toEqual([
        { id: 101, price: 100, sale_price: 80 },
        { id: 102, price: 200, sale_price: 160 },
      ]);
    });

    it("includes sale_end when provided", () => {
      const payload = prepareBulkDiscountPayload(mockProducts, {
        discountType: "fixed",
        discountValue: 15,
        saleEnd: "2026-12-31",
      });

      expect(payload).toEqual([
        { id: 101, price: 100, sale_price: 85, sale_end: "2026-12-31" },
        { id: 102, price: 200, sale_price: 185, sale_end: "2026-12-31" },
      ]);
    });
  });

  describe("prepareRemoveDiscountPayload", () => {
    it("sets sale_price and sale_end to null per Salla API spec", () => {
      const mockProducts = [
        {
          id: 201,
          price: 150,
          sale_price: 120,
        },
        {
          id: 202,
          price: { amount: 300, currency: "SAR" },
          sale_price: { amount: 250, currency: "SAR" },
        },
      ];

      const payload = prepareRemoveDiscountPayload(mockProducts);

      expect(payload).toEqual([
        { id: 201, price: 150, sale_price: null, sale_end: null },
        { id: 202, price: 300, sale_price: null, sale_end: null },
      ]);
    });
  });

  describe("bulkUpdateProductPrices", () => {
    it("calls serverless endpoint with action 'bulk_price'", async () => {
      const mockResponse = {
        success: true,
        count: 2,
        message: "The details has been queued to update",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const productsPayload = [
        { id: 1, price: 100, sale_price: 80 },
        { id: 2, price: 200, sale_price: 160 },
      ];

      const res = await bulkUpdateProductPrices("mock-token", productsPayload);

      expect(global.fetch).toHaveBeenCalledWith(
        PRODUCTS_FUNCTION_URL,
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "bulk_price",
            token: "mock-token",
            appId: null,
            products: productsPayload,
          }),
        }),
      );

      expect(res.success).toBe(true);
      expect(res.count).toBe(2);
    });

    it("handles network failure gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network timeout"));

      const res = await bulkUpdateProductPrices("mock-token", []);
      expect(res.success).toBe(false);
      expect(res.code).toBe("network_error");
      expect(res.error).toBe("Network timeout");
    });
  });
});
