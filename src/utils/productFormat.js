// Pure display helpers for Salla product objects (no React, no API calls).

/** "99 SAR" for money objects, the raw value for numbers, "—" when missing. */
export function formatPrice(price) {
  if (price == null) return "—";
  if (typeof price === "object") {
    return `${price.amount ?? "—"} ${price.currency ?? ""}`.trim();
  }
  return String(price);
}

function positiveAmount(value) {
  const raw = typeof value === "object" ? value?.amount : value;
  if (raw === undefined || raw === null || raw === "") return null;
  const num = Number(raw);
  return !isNaN(num) && num > 0 ? num : null;
}

/** Regular (pre-discount) price as a money object, falling back to `price`. */
export function getDisplayRegularPrice(product) {
  if (!product) return null;
  const reg = product.regular_price;
  const amount = positiveAmount(reg);
  if (amount !== null) {
    return typeof reg === "object"
      ? reg
      : { amount, currency: product.price?.currency || "SAR" };
  }
  return product.price;
}

/** Sale price as a money object, or null when the product is not discounted. */
export function getDisplaySalePrice(product) {
  if (!product) return null;
  const sale = product.sale_price;
  const amount = positiveAmount(sale);
  if (amount === null) return null;
  return typeof sale === "object"
    ? sale
    : { amount, currency: product.price?.currency || "SAR" };
}

/**
 * What the price cell should show.
 * Returns `{ hasSale, regular, sale, price }`; `hasSale` is true only when the
 * sale price is lower than the regular price.
 */
export function getPriceDisplay(product) {
  const regular = getDisplayRegularPrice(product);
  const sale = getDisplaySalePrice(product);
  const regNum = Number(
    typeof regular === "object" ? regular?.amount : regular,
  );
  const saleNum = Number(typeof sale === "object" ? sale?.amount : sale);
  const hasSale = Boolean(
    sale &&
    !isNaN(saleNum) &&
    saleNum > 0 &&
    (!isNaN(regNum) ? saleNum < regNum : true),
  );
  return { hasSale, regular, sale, price: product?.price };
}

function isMainImage(img) {
  return (
    img &&
    (img.is_main === true ||
      img.main === true ||
      img.default === true ||
      img.is_default === true)
  );
}

/**
 * Best thumbnail URL for a product: an image flagged main/default, then
 * sort === 1, then `main_image`, then the first image, then `thumbnail`.
 */
export function productImage(product) {
  if (!product) return null;

  if (Array.isArray(product.images) && product.images.length > 0) {
    const mainImg = product.images.find(isMainImage);
    const mainUrl = mainImg && (mainImg.url || mainImg.original);
    if (mainUrl) return mainUrl;

    const sort1Img = product.images.find(
      (img) => img && Number(img.sort) === 1,
    );
    const sortUrl = sort1Img && (sort1Img.url || sort1Img.original);
    if (sortUrl) return sortUrl;
  }

  if (product.main_image) return product.main_image;

  if (Array.isArray(product.images) && product.images.length > 0) {
    const firstUrl = product.images[0]?.url || product.images[0]?.original;
    if (firstUrl) return firstUrl;
  }

  return product.thumbnail || product.image?.url || null;
}

/** Stock cell text: "∞" for unlimited, the quantity, or "—". */
export function formatStock(product) {
  if (product?.unlimited_quantity) return "∞";
  return product?.quantity ?? "—";
}
