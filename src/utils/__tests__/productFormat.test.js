import { describe, it, expect } from "vitest";
import { formatPrice, formatStock, getPriceDisplay } from "../productFormat.js";
import {
  applyBulkResultToProducts,
  mergeUpdatedProduct,
} from "../productListUpdates.js";

describe("productFormat", () => {
  it("formats prices", () => {
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice({ amount: 5, currency: "SAR" })).toBe("5 SAR");
    expect(formatPrice(7)).toBe("7");
  });

  it("detects a real sale", () => {
    expect(
      getPriceDisplay({ regular_price: 200, sale_price: 150, price: 150 })
        .hasSale,
    ).toBe(true);
    expect(
      getPriceDisplay({ regular_price: 100, sale_price: 150, price: 100 })
        .hasSale,
    ).toBe(false);
  });

  it("formats stock", () => {
    expect(formatStock({ unlimited_quantity: true })).toBe("∞");
    expect(formatStock({ quantity: 3 })).toBe(3);
    expect(formatStock({})).toBe("—");
  });
});

describe("productListUpdates", () => {
  it("keeps sent images and main image after an update", () => {
    const updated = mergeUpdatedProduct(
      { id: 1, name: "a" },
      { name: "b" },
      { images: [{ original: "x", default: true }] },
    );
    expect(updated).toMatchObject({
      name: "b",
      main_image: "x",
      thumbnail: "x",
    });
  });

  it("applies and removes bulk discounts", () => {
    const products = [{ id: 1, price: { amount: 100, currency: "SAR" } }];
    const applied = applyBulkResultToProducts(
      products,
      [{ id: 1, sale_price: 80 }],
      "apply",
    );
    expect(applied[0].sale_price).toEqual({ amount: 80, currency: "SAR" });
    expect(applied[0].regular_price).toEqual({ amount: 100, currency: "SAR" });

    const removed = applyBulkResultToProducts(applied, [{ id: 1 }], "remove");
    expect(removed[0]).toMatchObject({ sale_price: null, regular_price: null });
  });
});
