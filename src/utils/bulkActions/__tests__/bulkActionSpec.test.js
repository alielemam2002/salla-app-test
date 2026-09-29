import { describe, expect, it } from "vitest";
import {
  PRICING_FORMULAS,
  SALLA_BULK_ACTIONS,
  applyFormula,
  buildFilters,
  buildOperation,
  sanitizeFilters,
  sanitizeOperation,
} from "../bulkActionSpec.js";
import { buildPricingPreview, describeBulkError } from "../bulkActionUi.js";

describe("Salla bulk action contract", () => {
  it("only knows the documented action names", () => {
    expect(SALLA_BULK_ACTIONS).toEqual([
      "duplicate",
      "sale-channels",
      "features",
      "notify-quantity",
      "pricing",
      "restore",
    ]);
    expect(buildOperation("delete").error).toBeTruthy();
  });

  it("sends the docs' formula strings verbatim", () => {
    const { operation } = buildOperation("pricing", {
      column: "sale_price",
      formulaId: "price_minus_percent",
      amount: 20,
      apply_on: "product",
    });
    expect(operation).toEqual({
      action_name: "pricing",
      value: {
        column: "sale_price",
        formula: "price - (price * amount /100 )",
        amount: 20,
        apply_on: "product",
      },
    });
  });

  it("refuses formulas the docs don't list for a column", () => {
    // Decreasing `price` itself isn't in the docs' table for column price.
    expect(
      buildOperation("pricing", {
        column: "price",
        formulaId: "price_minus_percent",
        amount: 10,
        apply_on: "product",
      }).error,
    ).toMatch(/Unsupported/);
    expect(PRICING_FORMULAS.price.map((f) => f.formula)).not.toContain(
      "price - amount",
    );
  });

  it("blocks unsafe pricing values", () => {
    const base = { column: "sale_price", apply_on: "product" };
    expect(
      buildOperation("pricing", {
        ...base,
        formulaId: "price_minus_percent",
        amount: 100,
      }).error,
    ).toMatch(/below 100/);
    expect(
      buildOperation("pricing", {
        ...base,
        formulaId: "set_amount",
        amount: -5,
      }).error,
    ).toMatch(/greater than 0/);
    expect(
      buildOperation("pricing", {
        ...base,
        formulaId: "set_amount",
        amount: 5,
        apply_on: "all",
      }).error,
    ).toMatch(/apply_on/);
  });

  it("builds features, channels and notify-quantity payloads", () => {
    expect(
      buildOperation("features", { categories: ["5", "x"], tags: [] })
        .operation,
    ).toEqual({ action_name: "features", value: { categories: [5] } });
    expect(buildOperation("features", {}).error).toBeTruthy();
    expect(
      buildOperation("sale-channels", { channels: ["web", "tv", "web"] })
        .operation.value,
    ).toEqual({ channels: ["web"] });
    expect(
      buildOperation("notify-quantity", {
        notify_quantity: 10,
        minimum_notify_quantity: 20,
        subscribers_percentage: 5,
      }).operation.value,
    ).toEqual({
      notify_quantity: 10,
      minimum_notify_quantity: 20,
      subscribers_percentage: 5,
    });
    expect(
      buildOperation("notify-quantity", {
        notify_quantity: 1,
        minimum_notify_quantity: 1,
        subscribers_percentage: 101,
      }).error,
    ).toBeTruthy();
    expect(buildOperation("duplicate").operation).toEqual({
      action_name: "duplicate",
    });
  });

  it("turns a selection into Salla filters without sending every id", () => {
    expect(buildFilters({ mode: "ids", ids: [3, 4] })).toMatchObject({
      select_all: false,
      ids: [3, 4],
      unselected_ids: [],
      status: [],
    });
    expect(
      buildFilters({
        mode: "all",
        excludedIds: [9],
        status: "sale",
        categoryId: "77",
      }),
    ).toEqual({
      select_all: true,
      unselected_ids: ["9"],
      ids: [],
      categories: ["77"],
      brands: [],
      status: ["sale"],
      types: [],
    });
  });

  it("re-validates on the server", () => {
    expect(sanitizeFilters({ ids: [] }).error).toBeTruthy();
    expect(
      sanitizeFilters({ select_all: true, status: ["sale", "evil"] }).filters
        .status,
    ).toEqual(["sale"]);
    expect(
      sanitizeOperation({
        action_name: "pricing",
        value: {
          column: "price",
          formula: "price * 0",
          amount: 1,
          apply_on: "product",
        },
      }).error,
    ).toBeTruthy();
    expect(
      sanitizeOperation({
        action_name: "pricing",
        value: {
          column: "price",
          formula: "price + (price * amount /100 )",
          amount: 10,
          apply_on: "product_and_variants",
        },
      }).operation.value.formula,
    ).toBe("price + (price * amount /100 )");
  });
});

describe("pricing preview", () => {
  it("mirrors the formulas", () => {
    const prices = { price: 100, salePrice: 80, costPrice: 50 };
    expect(applyFormula("price_minus_percent", 20, prices)).toBe(80);
    expect(applyFormula("sale_minus_amount", 30, prices)).toBe(50);
    expect(applyFormula("cost_add_percent", 10, prices)).toBe(55);
    expect(applyFormula("set_amount", 42, prices)).toBe(42);
    expect(applyFormula("sale_minus_amount", 5, { price: 10 })).toBeNull();
  });

  it("flags negative, zero and not-below-price results", () => {
    const products = [
      { id: 1, name: "A", price: { amount: 100 }, sale_price: 0 },
      { id: 2, name: "B", price: 40 },
      { id: 3, name: "C", price: 50 },
    ];
    const rows = buildPricingPreview(products, {
      column: "sale_price",
      formulaId: "price_minus_amount",
      amount: 50,
    });
    expect(rows.map((r) => [r.next, r.problem])).toEqual([
      [50, null],
      [-10, "negative"],
      [0, "zero"],
    ]);
    const up = buildPricingPreview([{ id: 4, name: "D", price: 100 }], {
      column: "sale_price",
      formulaId: "set_amount",
      amount: 150,
    });
    expect(up[0].problem).toBe("not_below_price");
  });

  it("keeps raw API errors out of the main message", () => {
    const error = describeBulkError({
      status: 422,
      error: "alert.invalid_fields",
      fields: { "operations.0.action_name": ["invalid"] },
    });
    expect(error.reason).toBe(
      "Salla rejected the requested settings for this action.",
    );
    expect(error.debug).toMatch(/operations\.0\.action_name/);
    expect(describeBulkError({ status: 429 }).reason).toMatch(/minute/);
    expect(
      describeBulkError({ status: 0, code: "network_error" }).reason,
    ).toMatch(/Network/);
  });
});
