// Pure logic for the Bulk Discount modal: preview sample, target count,
// validation and preview rows.
import {
  calculateDiscountedPrice,
  getProductRegularPrice,
} from "./discountsApi.js";

const categoryIdOf = (c) => (typeof c === "object" ? c.id : c);

/** Products shown in the preview table for the chosen target. */
export function getPreviewProducts({
  target,
  selectedProducts,
  allLoadedProducts,
  selectedCategoryId,
}) {
  if (target === "selected") return selectedProducts;
  if (target === "category") {
    if (!selectedCategoryId) return [];
    const catId = Number(selectedCategoryId);
    const matched = allLoadedProducts.filter(
      (p) =>
        Array.isArray(p.categories) &&
        p.categories.some((c) => categoryIdOf(c) === catId),
    );
    return matched.length > 0 ? matched : allLoadedProducts.slice(0, 5);
  }
  return allLoadedProducts.slice(0, 8);
}

/** Number (or label) of products the operation will touch. */
export function estimateTargetCount({
  target,
  selectedProducts,
  categories,
  selectedCategoryId,
  previewCount,
  totalStoreProducts,
  allLoadedCount,
}) {
  if (target === "selected") return selectedProducts.length;
  if (target === "category") {
    const cat = categories.find((c) => c.id === Number(selectedCategoryId));
    return cat?.products_count || previewCount || "كل منتجات التصنيف";
  }
  return totalStoreProducts || allLoadedCount || "كل منتجات المتجر";
}

/** First blocking problem with the current settings, or null. */
export function validateBulkDiscount({
  mode,
  discountType,
  discountValue,
  target,
  selectedCount,
  selectedCategoryId,
}) {
  const valNum = Number(discountValue);
  let error = null;

  if (mode === "apply") {
    if (discountValue === "" || isNaN(valNum) || valNum <= 0) {
      error = "أدخل قيمة خصم صحيحة أكبر من 0.";
    } else if (discountType === "percentage" && valNum > 100) {
      error = "لا يمكن أن تتجاوز نسبة الخصم 100%.";
    }
  }
  if (target === "selected" && selectedCount === 0) {
    error = "لم تحدد أي منتجات. حدّد منتجات من الجدول أو اختر نطاقًا آخر.";
  }
  if (target === "category" && !selectedCategoryId) {
    error = "اختر تصنيفًا.";
  }
  return error;
}

/** Rows for the preview table. */
export function buildPreviewRows(
  products,
  { mode, discountType, discountValue },
) {
  const valNum = Number(discountValue);
  return products.map((p) => {
    const regularPrice = getProductRegularPrice(p);
    const currentSale = p.sale_price?.amount ?? p.sale_price ?? null;
    return {
      id: p.id,
      name: p.name,
      regularPrice,
      currentSale,
      hasCurrentSale: Boolean(p.sale_price?.amount || p.sale_price),
      newPrice:
        mode === "apply"
          ? calculateDiscountedPrice(regularPrice, discountType, valNum)
          : regularPrice,
    };
  });
}

/** "20%" or "15 SAR". */
export function formatDiscount(discountType, value) {
  return discountType === "percentage" ? `${value}%` : `${value} SAR`;
}

/** Human label for the chosen target. */
export function describeTarget({ target, selectedCount, selectedCategoryId }) {
  if (target === "selected") return `${selectedCount} منتج محدد`;
  if (target === "category") return `التصنيف #${selectedCategoryId}`;
  return "كل منتجات المتجر";
}
