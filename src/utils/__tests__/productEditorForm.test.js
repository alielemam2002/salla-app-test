import { describe, it, expect } from "vitest";
import {
  buildPreviewUrl,
  buildProductPayload,
  computePricingInsight,
  EMPTY_PRODUCT_FORM,
  normalizeProductImages,
  normalizeTags,
  parseOptionValues,
  productToFormValues,
  promoteImage,
  removeImageAt,
  scoreTone,
  variantLabel,
  variantToFormValues,
} from "../productEditorForm.js";

describe("productToFormValues", () => {
  it("maps money objects, zero sale price and categories", () => {
    const values = productToFormValues({
      name: "Tee",
      price: { amount: 100, currency: "SAR" },
      sale_price: { amount: 0 },
      sale_end: "2030-01-01",
      categories: [{ id: 5 }, 7],
      brand: { id: 3 },
      tags: "a, b",
    });
    expect(values.price).toBe(100);
    expect(values.sale_price).toBe("");
    expect(values.sale_end).toBe("");
    expect(values.categories).toEqual([5, 7]);
    expect(values.brand_id).toBe(3);
    expect(values.tags).toEqual([{ name: "a" }, { name: "b" }]);
  });

  it("blanks quantity when stock is unlimited", () => {
    const values = productToFormValues({
      unlimited_quantity: true,
      quantity: 9,
    });
    expect(values.quantity).toBe("");
    expect(values.unlimited_quantity).toBe(true);
  });

  it("maps promotional_title and sub_title aliases correctly", () => {
    const values = productToFormValues({
      promotional_title: "خصم 30%",
      sub_title: "قطن مصري",
    });
    expect(values.promotion_title).toBe("خصم 30%");
    expect(values.subtitle).toBe("قطن مصري");
  });

  it("maps promotion.title and short_description aliases correctly", () => {
    const values = productToFormValues({
      promotion: { title: "عرض الصيف" },
      short_description: "وصف توضيحي",
    });
    expect(values.promotion_title).toBe("عرض الصيف");
    expect(values.subtitle).toBe("وصف توضيحي");
  });
});

describe("normalizeTags", () => {
  it("keeps tag ids and drops empty names", () => {
    expect(normalizeTags([{ id: 1, name: "x" }, { name: "" }, "y"])).toEqual([
      { id: 1, name: "x" },
      { name: "y" },
    ]);
  });
});

describe("images", () => {
  it("prefers query images and falls back to the thumbnail", () => {
    const fromQuery = normalizeProductImages({}, [{ id: 1, url: "u1" }]);
    expect(fromQuery[0]).toMatchObject({
      id: 1,
      original: "u1",
      default: true,
    });
    expect(normalizeProductImages({ thumbnail: "t" }, [])).toEqual([
      { original: "t", default: true, sort: 1, alt: "" },
    ]);
    expect(normalizeProductImages({}, [])).toBeNull();
  });

  it("promotes and removes images keeping one main image", () => {
    const imgs = [
      { original: "a", default: true },
      { original: "b", default: false },
    ];
    const promoted = promoteImage(imgs, 1);
    expect(promoted.map((i) => i.original)).toEqual(["b", "a"]);
    expect(promoted[0].default).toBe(true);
    expect(removeImageAt(imgs, 0)).toEqual([{ original: "b", default: true }]);
  });
});

describe("buildProductPayload", () => {
  const base = { ...EMPTY_PRODUCT_FORM, name: " Tee ", price: "100" };

  it("rejects a sale price that is not below the price", () => {
    expect(buildProductPayload({ ...base, sale_price: "100" }).error).toMatch(
      /سعر الخصم/,
    );
  });

  it("builds the PUT body", () => {
    const { payload } = buildProductPayload(
      {
        ...base,
        quantity: "4",
        sale_price: "80",
        metadata_url: "My Tee",
        brand_id: "3",
      },
      [{ id: 9, original: "img" }],
    );
    expect(payload).toMatchObject({
      name: "Tee",
      price: 100,
      quantity: 4,
      sale_price: 80,
      metadata_url: "my-tee",
      brand_id: 3,
      images: [
        { id: 9, original: "img", default: true, sort: 1, alt: " Tee " },
      ],
    });
  });

  it("omits quantity when unlimited and nulls a missing sale", () => {
    const { payload } = buildProductPayload({
      ...base,
      unlimited_quantity: true,
      quantity: "4",
    });
    expect(payload).not.toHaveProperty("quantity");
    expect(payload.sale_price).toBeNull();
  });

  it("builds payload with both subtitle and promotion_title aliases", () => {
    const { payload } = buildProductPayload({
      ...base,
      subtitle: "قطن مصري عالي الجودة",
      promotion_title: "خصم 30%",
    });
    expect(payload.subtitle).toBe("قطن مصري عالي الجودة");
    expect(payload.sub_title).toBe("قطن مصري عالي الجودة");
    expect(payload.promotion_title).toBe("خصم 30%");
    expect(payload.promotional_title).toBe("خصم 30%");
  });
});

describe("computePricingInsight", () => {
  it("uses the sale price for profit and computes discount", () => {
    expect(
      computePricingInsight({ price: 100, salePrice: 80, costPrice: 50 }),
    ).toMatchObject({ profit: 30, margin: 38, discountPercent: 20 });
    expect(computePricingInsight({ price: 100 }).profit).toBeNull();
  });
});

describe("misc helpers", () => {
  it("parses option values", () => {
    expect(parseOptionValues("S, M;L\n")).toEqual([
      { name: "S" },
      { name: "M" },
      { name: "L" },
    ]);
  });

  it("maps variants", () => {
    expect(
      variantToFormValues({ price: { amount: 5 }, quantity: 2 }),
    ).toMatchObject({ price: 5, stock_quantity: 2, sku: "" });
    expect(
      variantLabel({ related_option_values: [{ name: "S" }, { name: "Red" }] }),
    ).toBe("S - Red");
  });

  it("swaps the slug in the preview URL", () => {
    expect(buildPreviewUrl("https://s.com/old/p12", "new")).toBe(
      "https://s.com/new/p12",
    );
    expect(buildPreviewUrl(null, "")).toBe(
      "https://store.salla.sa/product-slug",
    );
  });

  it("maps score to tone", () => {
    expect(scoreTone(90)).toBe("high");
    expect(scoreTone(60)).toBe("mid");
    expect(scoreTone(10)).toBe("low");
  });
});
