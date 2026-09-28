// Pure logic for the Add/Edit product form: initial values, validation,
// image/category list operations and the Salla request payload.

export const EMPTY_PRODUCT_FORM = {
  name: "",
  product_type: "product",
  status: "sale",
  description: "",
  subtitle: "",
  price: "",
  sale_price: "",
  cost_price: "",
  sku: "",
  quantity: "10",
  unlimited_quantity: false,
  maximum_quantity_per_order: "",
  require_shipping: true,
  weight: "",
  weight_type: "kg",
  brand_id: "",
  categories: [],
  manualCategoryIds: "",
  images: [],
};

const amountOf = (value) =>
  typeof value === "object" ? (value?.amount ?? "") : (value ?? "");

const imageUrl = (img) =>
  typeof img === "string" ? img : img?.url || img?.original || "";

const urlsMatch = (u, target) =>
  u && (u === target || target.includes(u) || u.includes(target));

/** Index of the product's main image using Salla's various flags. */
function findMainImageIndex(product) {
  const images = product.images;

  let idx = images.findIndex(
    (img) =>
      img &&
      typeof img === "object" &&
      Boolean(img.is_main || img.main || img.default || img.is_default),
  );
  if (idx === -1) {
    idx = images.findIndex(
      (img) => img && typeof img === "object" && Number(img.sort) === 1,
    );
  }
  if (idx === -1 && typeof product.main_image === "string") {
    idx = images.findIndex(
      (img) => img && urlsMatch(imageUrl(img), product.main_image),
    );
  }
  if (idx === -1 && typeof product.thumbnail === "string") {
    idx = images.findIndex(
      (img) => img && urlsMatch(imageUrl(img), product.thumbnail),
    );
  }
  return idx === -1 ? 0 : idx;
}

/** Form images with the main image first and flagged `default`. */
function initialImages(product) {
  if (Array.isArray(product.images) && product.images.length > 0) {
    const mainIdx = findMainImageIndex(product);
    const images = [];
    product.images.forEach((img, idx) => {
      const url = imageUrl(img);
      if (url) {
        images.push({
          id: typeof img === "object" ? img.id : undefined,
          original: url,
          default: idx === mainIdx,
          alt: typeof img === "object" ? img.alt || "" : "",
        });
      }
    });
    if (mainIdx > 0 && images.length > mainIdx) {
      const [mainItem] = images.splice(mainIdx, 1);
      images.unshift(mainItem);
    }
    return images;
  }
  if (product.thumbnail || product.main_image) {
    return [
      {
        original: product.thumbnail || product.main_image,
        default: true,
        alt: product.name || "",
      },
    ];
  }
  return [];
}

const toStr = (v) =>
  v !== undefined && v !== null && v !== "" ? String(v) : "";

/** Form values for a product (edit) or the empty defaults (create). */
export function productToFormValues(product) {
  if (!product) return { ...EMPTY_PRODUCT_FORM, categories: [], images: [] };

  const regPrice =
    product.regular_price !== undefined && product.regular_price !== null
      ? product.regular_price
      : product.price;

  const catIds = Array.isArray(product.categories)
    ? product.categories
        .map((c) => (typeof c === "object" ? c.id : c))
        .filter(Boolean)
    : [];

  const brandId = product.brand?.id ?? product.brand_id ?? "";

  return {
    name: product.name || "",
    product_type: product.type || product.product_type || "product",
    status: product.status || "sale",
    description: product.description || "",
    subtitle:
      product.subtitle ||
      product.sub_title ||
      product.short_description ||
      product.subTitle ||
      "",
    price: toStr(amountOf(regPrice)),
    sale_price: toStr(amountOf(product.sale_price)),
    cost_price: toStr(amountOf(product.cost_price)),
    sku: product.sku || "",
    quantity: toStr(product.quantity),
    unlimited_quantity: Boolean(product.unlimited_quantity),
    maximum_quantity_per_order: toStr(product.maximum_quantity_per_order),
    require_shipping:
      product.require_shipping !== undefined
        ? Boolean(product.require_shipping)
        : true,
    weight: product.weight ? String(product.weight) : "",
    weight_type: product.weight_type || "kg",
    brand_id: brandId ? String(brandId) : "",
    categories: catIds,
    manualCategoryIds: catIds.join(", "),
    images: initialImages(product),
  };
}

/** Field-level validation. Returns `{ field: message }` (empty when valid). */
export function validateProductForm(values) {
  const errors = {};
  const price = Number(values.price);
  const sale = Number(values.sale_price);

  if (!values.name.trim()) {
    errors.name = "Product name is required.";
  }
  if (values.price === "" || isNaN(price)) {
    errors.price = "A valid price is required.";
  } else if (price < 0) {
    errors.price = "Price cannot be negative.";
  }

  if (values.sale_price !== "" && !isNaN(sale)) {
    if (sale < 0) {
      errors.sale_price = "Sale price cannot be negative.";
    } else if (values.price !== "" && !isNaN(price) && sale >= price) {
      errors.sale_price = "Sale price must be lower than the regular price.";
    }
  }

  if (
    !values.unlimited_quantity &&
    values.quantity !== "" &&
    (isNaN(Number(values.quantity)) || Number(values.quantity) < 0)
  ) {
    errors.quantity = "Quantity must be a non-negative number.";
  }

  return errors;
}

/** Append an image URL; the first image becomes the main one. */
export function addImage(images, url, alt = "") {
  const trimmed = url.trim();
  if (!trimmed) return images;
  return [...images, { original: trimmed, default: images.length === 0, alt }];
}

/** Remove an image, promoting the first remaining one if the main was removed. */
export function removeImage(images, index) {
  const next = images.filter((_, idx) => idx !== index);
  if (next.length > 0 && !next.some((img) => img.default)) {
    next[0] = { ...next[0], default: true };
  }
  return next;
}

/** Make an image the main one and move it to the front. */
export function setMainImage(images, index) {
  const target = images[index];
  if (!target) return images;
  return [
    { ...target, default: true },
    ...images
      .filter((_, idx) => idx !== index)
      .map((img) => ({ ...img, default: false })),
  ];
}

/** Toggle a category id in the list. */
export function toggleCategoryId(categories, catId) {
  const numId = Number(catId);
  return categories.includes(numId)
    ? categories.filter((id) => id !== numId)
    : [...categories, numId];
}

/** Parse "1, 2;3 4" into numeric ids. */
export function parseCategoryIds(text) {
  return text
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s && !isNaN(Number(s)))
    .map(Number);
}

/** Salla create/update request body from form values. */
export function buildProductPayload(values, isEditing) {
  const mergedCategories = Array.from(
    new Set([
      ...values.categories,
      ...parseCategoryIds(values.manualCategoryIds),
    ]),
  );

  const payload = {
    name: values.name.trim(),
    price: Number(values.price),
    regular_price: Number(values.price),
    status: values.status,
    description: values.description.trim() || undefined,
    subtitle: values.subtitle.trim() || undefined,
    sku: values.sku.trim() || undefined,
    unlimited_quantity: values.unlimited_quantity,
    require_shipping: values.require_shipping,
  };

  if (!isEditing) {
    payload.product_type = values.product_type || "product";
  }

  if (values.unlimited_quantity) {
    payload.quantity = 0;
  } else if (values.quantity !== "") {
    payload.quantity = Number(values.quantity);
  }

  if (values.sale_price !== "") {
    payload.sale_price = Number(values.sale_price);
  } else if (isEditing) {
    payload.sale_price = null;
  }
  if (values.cost_price !== "") {
    payload.cost_price = Number(values.cost_price);
  }
  if (values.maximum_quantity_per_order !== "") {
    payload.maximum_quantity_per_order = Number(
      values.maximum_quantity_per_order,
    );
  }
  if (values.weight !== "") {
    payload.weight = Number(values.weight);
    payload.weight_type = values.weight_type || "kg";
  }

  if (mergedCategories.length > 0) {
    payload.categories = mergedCategories;
  }

  if (values.brand_id && !isNaN(Number(values.brand_id))) {
    payload.brand_id = Number(values.brand_id);
  }

  if (values.images.length > 0) {
    // The default (main) image goes first
    const sorted = [...values.images].sort((a, b) => {
      if (a.default && !b.default) return -1;
      if (!a.default && b.default) return 1;
      return 0;
    });

    payload.images = sorted.map((img, idx) => ({
      ...(img.id ? { id: img.id } : {}),
      original: img.original,
      url: img.original,
      default: idx === 0,
      is_main: idx === 0,
      main: idx === 0,
      sort: idx + 1,
      alt: img.alt || values.name || "",
    }));

    payload.main_image = sorted[0].original;
  }

  return payload;
}

/** Flatten Salla's `{ field: [msgs] }` validation errors to `{ field: "a, b" }`. */
export function mapServerFieldErrors(fields) {
  const mapped = {};
  Object.entries(fields || {}).forEach(([k, v]) => {
    mapped[k] = Array.isArray(v) ? v.join(", ") : String(v);
  });
  return mapped;
}
