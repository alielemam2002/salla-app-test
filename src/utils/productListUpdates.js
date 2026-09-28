// Pure reducers that patch the in-memory product list after a mutation,
// so the table updates without waiting for a refetch.

/** Merge an update response into the row, keeping the images we just sent. */
export function mergeUpdatedProduct(existing, responseProduct, payload) {
  const chosenMainImage =
    payload.main_image ||
    (Array.isArray(payload.images) && payload.images.length > 0
      ? payload.images.find((img) => img.default || img.is_main || img.main)
          ?.original || payload.images[0]?.original
      : null);

  const updated = { ...existing, ...responseProduct };
  if (Array.isArray(payload.images)) {
    updated.images = payload.images;
  }
  if (chosenMainImage) {
    updated.main_image = chosenMainImage;
    updated.thumbnail = chosenMainImage;
  }
  return updated;
}

/** Apply a bulk price result ("apply" or "remove" mode) to the list. */
export function applyBulkResultToProducts(products, payload, mode) {
  return products.map((p) => {
    const updated = payload.find((item) => Number(item.id) === Number(p.id));
    if (!updated) return p;

    const baseRegular = p.regular_price || p.price;
    const currency =
      typeof baseRegular === "object" ? baseRegular.currency || "SAR" : "SAR";

    if (mode === "apply") {
      return {
        ...p,
        regular_price: baseRegular,
        price: { amount: updated.sale_price, currency },
        sale_price: { amount: updated.sale_price, currency },
      };
    }
    return { ...p, price: baseRegular, regular_price: null, sale_price: null };
  });
}
