/**
 * Pure mapping helpers for the Product Editor: Salla product <-> form values,
 * image normalisation, the PUT /products/{id} payload, variants and pricing.
 * No React, no network.
 */
import { slugify } from "./slugify.js";

export const EMPTY_PRODUCT_FORM = {
  name: "",
  description: "",
  categories: [],
  brand_id: "",
  price: "",
  sale_price: "",
  sale_end: "",
  cost_price: "",
  quantity: "",
  unlimited_quantity: false,
  maximum_quantity_per_order: "",
  hide_quantity: false,
  sku: "",
  gtin: "",
  mpn: "",
  promotion_title: "",
  subtitle: "",
  tags: [],
  metadata_title: "",
  metadata_description: "",
  metadata_url: "",
};

/** Salla money fields are either a number or `{ amount, currency }`. */
export function amountOf(value) {
  return typeof value === "object" && value !== null ? value.amount : value;
}

export const tagName = (t) => (typeof t === "object" ? t?.name : t) || "";

/** Normalise a product's `tags` (array of objects/strings, or CSV string). */
export function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    // Keep { id, name } so saving can send tag IDs, as Salla's PUT expects
    return tags
      .map((t) =>
        typeof t === "object"
          ? { id: t.id, name: t.name }
          : { name: String(t) },
      )
      .filter((t) => t.name);
  }
  if (typeof tags === "string") {
    return tags
      .split(/[,;\n]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
  }
  return [];
}

/** Map a Salla product to react-hook-form default values. */
export function productToFormValues(product) {
  const p =
    typeof product.regular_price === "object"
      ? product.regular_price?.amount
      : (product.regular_price ??
        (typeof product.price === "object"
          ? product.price?.amount
          : (product.price ?? "")));

  // Salla returns sale_price { amount: 0 } when there is no sale
  const rawSale = amountOf(product.sale_price);
  const sp = Number(rawSale) > 0 ? rawSale : "";

  const cp =
    typeof product.cost_price === "object"
      ? product.cost_price?.amount
      : (product.cost_price ?? "");

  const catIds = Array.isArray(product.categories)
    ? product.categories
        .map((c) => (typeof c === "object" ? c.id : c))
        .filter(Boolean)
    : [];

  let savedLocal = null;
  try {
    if (typeof window !== "undefined" && product.id) {
      const raw = localStorage.getItem(`salla_product_meta_${product.id}`);
      if (raw) savedLocal = JSON.parse(raw);
    }
  } catch {
    // Ignore storage errors
  }

  return {
    name: product.name || "",
    description: product.description || "",
    categories: catIds,
    brand_id: product.brand_id || product.brand?.id || "",
    price: p,
    sale_price: sp,
    sale_end: sp !== "" ? product.sale_end || "" : "",
    cost_price: cp,
    quantity: product.unlimited_quantity ? "" : (product.quantity ?? ""),
    unlimited_quantity: Boolean(product.unlimited_quantity),
    maximum_quantity_per_order: product.maximum_quantity_per_order || "",
    hide_quantity: Boolean(product.hide_quantity),
    sku: product.sku || "",
    gtin: product.gtin || product.barcode || "",
    mpn: product.mpn || "",
    promotion_title:
      product.promotion_title ||
      product.promotional_title ||
      product.promotion?.title ||
      product.promotion?.name ||
      savedLocal?.promotion_title ||
      "",
    subtitle:
      product.subtitle ||
      product.sub_title ||
      product.short_description ||
      product.subTitle ||
      product.metadata?.subtitle ||
      product.metadata?.sub_title ||
      savedLocal?.subtitle ||
      "",
    tags: normalizeTags(product.tags),
    metadata_title: product.metadata_title || product.metadata?.title || "",
    metadata_description:
      product.metadata_description || product.metadata?.description || "",
    metadata_url: product.metadata_url || product.metadata?.url || "",
  };
}

/**
 * Editor image list from the images endpoint, falling back to
 * `product.images`, then the thumbnail. Returns `null` when there is nothing
 * to show (caller keeps its current list).
 */
export function normalizeProductImages(product, queryImages) {
  const rawImages =
    Array.isArray(queryImages) && queryImages.length > 0
      ? queryImages
      : Array.isArray(product.images) && product.images.length > 0
        ? product.images
        : [];

  if (rawImages.length > 0) {
    return rawImages.map((img, idx) => ({
      id: typeof img === "object" ? img.id : undefined,
      original: typeof img === "string" ? img : img.url || img.original || "",
      default: Boolean(img.default || img.is_main || img.main || idx === 0),
      sort: img.sort !== undefined ? Number(img.sort) : idx + 1,
      alt: typeof img === "object" ? img.alt || "" : "",
      // Salla lists YouTube videos with the images (type "video").
      type: img?.type === "video" ? "video" : "image",
      video_url: (typeof img === "object" && img.video_url) || "",
    }));
  }
  if (product.thumbnail || product.main_image) {
    return [
      {
        original: product.thumbnail || product.main_image,
        default: true,
        sort: 1,
        alt: product.name || "",
      },
    ];
  }
  return null;
}

/** Move image `index` to the front and mark it as the main image. */
export function promoteImage(images, index) {
  const target = images[index];
  if (!target) return images;
  return [
    { ...target, default: true, sort: 1 },
    ...images
      .filter((_, idx) => idx !== index)
      .map((img, i) => ({ ...img, default: false, sort: i + 2 })),
  ];
}

/** Remove image `index`; the first remaining image becomes main if needed. */
export function removeImageAt(images, index) {
  const next = images.filter((_, idx) => idx !== index);
  if (next.length > 0 && !next.some((img) => img.default)) {
    next[0] = { ...next[0], default: true };
  }
  return next;
}

const hasNumber = (v) => v !== "" && v !== undefined && !isNaN(Number(v));

/**
 * Build the PUT /products/{id} body.
 * Returns `{ payload }` or `{ error }` (an Arabic, user-facing message).
 */
export function buildProductPayload(formData, images = []) {
  const regPrice = Number(formData.price);
  if (isNaN(regPrice) || regPrice < 0) {
    return { error: "يرجى إدخال سعر صحيح للمنتج." };
  }

  const hasSale = formData.sale_price !== "" && Number(formData.sale_price) > 0;
  if (hasSale && Number(formData.sale_price) >= regPrice) {
    return { error: "سعر الخصم يجب أن يكون أقل من السعر الأساسي للمنتج." };
  }

  const sub = formData.subtitle?.trim() || undefined;
  const promo = formData.promotion_title?.trim() || undefined;

  const payload = {
    name: formData.name.trim(),
    price: regPrice,
    description: formData.description.trim() || undefined,
    subtitle: sub,
    sub_title: sub,
    promotion_title: promo,
    promotional_title: promo,
    sku: formData.sku.trim() || undefined,
    gtin: formData.gtin.trim() || undefined,
    mpn: formData.mpn.trim() || undefined,
    metadata_title: formData.metadata_title.trim() || undefined,
    metadata_description: formData.metadata_description.trim() || undefined,
    metadata_url: slugify(formData.metadata_url) || undefined,
    unlimited_quantity: formData.unlimited_quantity,
    hide_quantity: formData.hide_quantity,
  };

  if (
    hasNumber(formData.maximum_quantity_per_order) &&
    Number(formData.maximum_quantity_per_order) > 0
  ) {
    payload.maximum_quantity_per_order = Number(
      formData.maximum_quantity_per_order,
    );
  }

  // Salla ignores quantity when unlimited_quantity=true, so don't send it
  if (!formData.unlimited_quantity && hasNumber(formData.quantity)) {
    payload.quantity = Number(formData.quantity);
  }

  if (hasSale) {
    payload.sale_price = Number(formData.sale_price);
    if (formData.sale_end) payload.sale_end = formData.sale_end;
  } else {
    payload.sale_price = null;
  }

  if (formData.cost_price !== "" && !isNaN(Number(formData.cost_price))) {
    payload.cost_price = Number(formData.cost_price);
  }

  if (Array.isArray(formData.categories) && formData.categories.length > 0) {
    payload.categories = formData.categories;
  }

  if (formData.brand_id && !isNaN(Number(formData.brand_id))) {
    payload.brand_id = Number(formData.brand_id);
  }

  if (Array.isArray(formData.tags) && formData.tags.length > 0) {
    payload.tags = formData.tags;
  }

  const validImages = images
    .filter((img) => img && (img.original || img.url))
    .map((img, idx) => ({
      ...(img.id ? { id: img.id } : {}),
      original: img.original || img.url,
      default: idx === 0,
      sort: idx + 1,
      alt: img.alt || formData.name || "",
    }));
  if (validImages.length > 0) payload.images = validImages;

  return { payload };
}

/** Profit, margin and discount figures for the pricing insight. */
export function computePricingInsight({ price, salePrice, costPrice }) {
  const p = Number(price) || 0;
  const sp = Number(salePrice) || 0;
  const cp = Number(costPrice) || 0;
  const hasSale = sp > 0;
  const effectivePrice = hasSale ? sp : p;
  const profit = effectivePrice > 0 && cp > 0 ? effectivePrice - cp : null;
  return {
    hasSale,
    effectivePrice,
    costPrice: cp,
    profit,
    margin:
      profit !== null ? Math.round((profit / effectivePrice) * 100) : null,
    discountPercent:
      hasSale && p > sp ? Math.round(((p - sp) / p) * 100) : null,
  };
}

/** Split "a, b; c\nd" into option values `[{ name }]`. */
export function parseOptionValues(input) {
  return String(input || "")
    .split(/[,;\n]+/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
}

export function variantToFormValues(variant) {
  return {
    sku: variant.sku || "",
    price: amountOf(variant.price) ?? "",
    sale_price: amountOf(variant.sale_price) ?? "",
    cost_price: amountOf(variant.cost_price) ?? "",
    stock_quantity: variant.stock_quantity ?? variant.quantity ?? "",
    gtin: variant.gtin || variant.barcode || "",
    mpn: variant.mpn || "",
    weight: variant.weight ?? "",
  };
}

export function variantLabel(v) {
  return (
    v.name ||
    (Array.isArray(v.related_option_values)
      ? v.related_option_values.map((x) => x.name).join(" - ")
      : `متغير #${v.id}`)
  );
}

/**
 * Storefront URL preview. Salla product URLs look like
 * https://{store}/{slug}/p{id}, so swap the slug segment when we know it.
 */
export function buildPreviewUrl(productUrl, slug) {
  if (productUrl && slug) {
    const replaced = productUrl.replace(/\/[^/]+\/(p\d+)\/?$/, `/${slug}/$1`);
    if (replaced !== productUrl) return replaced;
  }
  return productUrl || `https://store.salla.sa/${slug || "product-slug"}`;
}

/** Completion tone used for colour: high (≥80), mid (≥50), low. */
export function scoreTone(score) {
  if (score >= 80) return "high";
  if (score >= 50) return "mid";
  return "low";
}
