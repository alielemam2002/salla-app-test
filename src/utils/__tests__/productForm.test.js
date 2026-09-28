import { describe, it, expect } from "vitest";
import {
  addImage,
  buildProductPayload,
  mapServerFieldErrors,
  parseCategoryIds,
  productToFormValues,
  removeImage,
  setMainImage,
  toggleCategoryId,
  validateProductForm,
} from "../productForm.js";

describe("productToFormValues", () => {
  it("returns create defaults for no product", () => {
    const v = productToFormValues(null);
    expect(v.quantity).toBe("10");
    expect(v.images).toEqual([]);
  });

  it("maps money objects, categories and brand", () => {
    const v = productToFormValues({
      name: "Cap",
      regular_price: { amount: 50 },
      sale_price: { amount: 40 },
      categories: [{ id: 3 }, 4],
      brand: { id: 9 },
      quantity: 0,
    });
    expect(v.price).toBe("50");
    expect(v.sale_price).toBe("40");
    expect(v.categories).toEqual([3, 4]);
    expect(v.manualCategoryIds).toBe("3, 4");
    expect(v.brand_id).toBe("9");
    expect(v.quantity).toBe("0");
  });

  it("moves the main image to the front", () => {
    const v = productToFormValues({
      images: [{ url: "a" }, { url: "b", is_main: true }],
    });
    expect(v.images.map((i) => i.original)).toEqual(["b", "a"]);
    expect(v.images[0].default).toBe(true);
  });
});

describe("validateProductForm", () => {
  const base = productToFormValues(null);

  it("requires name and price", () => {
    expect(validateProductForm(base)).toEqual({
      name: "Product name is required.",
      price: "A valid price is required.",
    });
  });

  it("rejects a sale price not below the regular price", () => {
    const errors = validateProductForm({
      ...base,
      name: "x",
      price: "10",
      sale_price: "10",
    });
    expect(errors.sale_price).toMatch(/lower than the regular price/);
  });
});

describe("image and category helpers", () => {
  it("adds, promotes and removes images", () => {
    let imgs = addImage([], " a ");
    imgs = addImage(imgs, "b");
    expect(imgs[0]).toMatchObject({ original: "a", default: true });
    imgs = setMainImage(imgs, 1);
    expect(imgs.map((i) => i.original)).toEqual(["b", "a"]);
    imgs = removeImage(imgs, 0);
    expect(imgs).toEqual([{ original: "a", default: true, alt: "" }]);
  });

  it("toggles and parses category ids", () => {
    expect(toggleCategoryId([1], "2")).toEqual([1, 2]);
    expect(toggleCategoryId([1, 2], 1)).toEqual([2]);
    expect(parseCategoryIds("1, 2;x 3")).toEqual([1, 2, 3]);
  });
});

describe("buildProductPayload", () => {
  it("builds a create payload with merged categories and main image", () => {
    const payload = buildProductPayload(
      {
        ...productToFormValues(null),
        name: " Cap ",
        price: "45",
        categories: [1],
        manualCategoryIds: "1, 2",
        images: [
          { original: "a", default: false },
          { original: "b", default: true },
        ],
      },
      false,
    );
    expect(payload).toMatchObject({
      name: "Cap",
      price: 45,
      product_type: "product",
      quantity: 10,
      categories: [1, 2],
      main_image: "b",
    });
    expect(payload.images[0]).toMatchObject({
      original: "b",
      sort: 1,
      is_main: true,
    });
  });

  it("clears the sale price on edit when left empty", () => {
    const payload = buildProductPayload(
      { ...productToFormValues(null), name: "x", price: "1" },
      true,
    );
    expect(payload.sale_price).toBeNull();
    expect(payload.product_type).toBeUndefined();
  });
});

it("flattens server field errors", () => {
  expect(mapServerFieldErrors({ name: ["a", "b"], sku: "c" })).toEqual({
    name: "a, b",
    sku: "c",
  });
});
