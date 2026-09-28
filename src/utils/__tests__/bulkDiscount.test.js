import { describe, it, expect } from "vitest";
import {
  buildPreviewRows,
  describeTarget,
  estimateTargetCount,
  getPreviewProducts,
  validateBulkDiscount,
} from "../bulkDiscount.js";

const products = [
  { id: 1, name: "A", price: 100, categories: [{ id: 5 }] },
  { id: 2, name: "B", price: 50, sale_price: 40, categories: [6] },
];

describe("bulkDiscount helpers", () => {
  it("picks preview products per target", () => {
    const args = {
      selectedProducts: [products[1]],
      allLoadedProducts: products,
    };
    expect(getPreviewProducts({ ...args, target: "selected" })).toEqual([
      products[1],
    ]);
    expect(
      getPreviewProducts({
        ...args,
        target: "category",
        selectedCategoryId: "5",
      }),
    ).toEqual([products[0]]);
    expect(
      getPreviewProducts({
        ...args,
        target: "category",
        selectedCategoryId: "",
      }),
    ).toEqual([]);
    expect(getPreviewProducts({ ...args, target: "all" })).toEqual(products);
  });

  it("estimates the target count", () => {
    expect(
      estimateTargetCount({
        target: "category",
        selectedProducts: [],
        categories: [{ id: 5, products_count: 12 }],
        selectedCategoryId: "5",
        previewCount: 1,
      }),
    ).toBe(12);
    expect(
      estimateTargetCount({
        target: "all",
        selectedProducts: [],
        totalStoreProducts: 0,
        allLoadedCount: 0,
      }),
    ).toBe("All store items");
  });

  it("validates settings", () => {
    const base = {
      mode: "apply",
      discountType: "percentage",
      discountValue: "20",
      target: "all",
      selectedCount: 0,
      selectedCategoryId: "",
    };
    expect(validateBulkDiscount(base)).toBeNull();
    expect(validateBulkDiscount({ ...base, discountValue: "150" })).toMatch(
      /exceed 100%/,
    );
    expect(validateBulkDiscount({ ...base, target: "selected" })).toMatch(
      /No products are selected/,
    );
    expect(validateBulkDiscount({ ...base, target: "category" })).toMatch(
      /select a category/,
    );
  });

  it("builds preview rows", () => {
    const rows = buildPreviewRows(products, {
      mode: "apply",
      discountType: "percentage",
      discountValue: "20",
    });
    expect(rows[0]).toMatchObject({
      regularPrice: 100,
      newPrice: 80,
      hasCurrentSale: false,
    });
    expect(rows[1]).toMatchObject({ currentSale: 40, hasCurrentSale: true });
  });

  it("describes the target", () => {
    expect(describeTarget({ target: "selected", selectedCount: 3 })).toBe(
      "3 Selected Products",
    );
    expect(describeTarget({ target: "category", selectedCategoryId: 9 })).toBe(
      "Category #9",
    );
  });
});
