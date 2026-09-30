// Static configuration for the Products tab and product form.

import { missingScopeMessage, storeAccessMessage } from "./sallaAccess.js";

export const PRODUCTS_PER_PAGE = 30;

// Setup hints shown for errors the merchant/developer can fix
export const PRODUCT_ERROR_HINTS = {
  store_not_authorized: storeAccessMessage("store_not_authorized"),
  token_expired: storeAccessMessage("token_expired"),
  token_refreshing: storeAccessMessage("token_refreshing"),
  token_refresh_failed: storeAccessMessage("token_refresh_failed"),
  oauth_not_configured: storeAccessMessage("oauth_not_configured"),
  missing_scope: missingScopeMessage(
    "المنتجات: قراءة وكتابة (products.read_write)",
  ),
  session_invalid:
    "انتهت صلاحية جلسة التطبيق أو أنها غير صالحة. اضغط «تحديث الجلسة» للحصول على جلسة جديدة.",
};

export const STATUS_FILTER_OPTIONS = [
  { value: "", label: "كل الحالات" },
  { value: "sale", label: "نشط" },
  { value: "out", label: "نفد من المخزون" },
  { value: "hidden", label: "مخفي" },
];

/** Badge tone per product status. */
export const PRODUCT_STATUS_TONES = {
  sale: "success",
  out: "danger",
  hidden: "neutral",
};

export const PRODUCT_TYPES = [
  { value: "product", label: "منتج مادي" },
  { value: "service", label: "خدمة" },
  { value: "digital", label: "منتج رقمي" },
  { value: "codes", label: "بطاقات وأكواد رقمية" },
  { value: "food", label: "وجبات وأطعمة" },
  { value: "group_products", label: "مجموعة منتجات" },
  { value: "donating", label: "تبرّع" },
];

export const PRODUCT_STATUSES = [
  { value: "sale", label: "نشط" },
  { value: "out", label: "نفد من المخزون" },
  { value: "hidden", label: "مخفي" },
];

export const WEIGHT_TYPES = [
  { value: "kg", label: "كيلوغرام (kg)" },
  { value: "g", label: "غرام (g)" },
  { value: "lb", label: "رطل (lb)" },
  { value: "oz", label: "أونصة (oz)" },
];

/** Arabic label for a product status value; unknown values are shown as-is. */
export function statusLabel(status) {
  if (!status) return "—";
  return PRODUCT_STATUSES.find((s) => s.value === status)?.label || status;
}

/** Arabic label for a product type value; unknown values are shown as-is. */
export function productTypeLabel(type) {
  return PRODUCT_TYPES.find((t) => t.value === type)?.label || type;
}
