// Static configuration for the Products tab and product form.

export const PRODUCTS_PER_PAGE = 30;

// Setup hints shown for errors the merchant/developer can fix
export const PRODUCT_ERROR_HINTS = {
  token_not_configured:
    "لم يتم ربط التطبيق بالمتجر بعد. أضف رمز الوصول إلى واجهة سلة (Merchant API) في Vercel باسم SALLA_ACCESS_TOKEN، ثم أعد النشر.",
  missing_scope:
    "الرمز يعمل لكنه لا يملك صلاحية المنتجات. فعّل صلاحية «المنتجات: قراءة وكتابة» (products.read_write) في بوابة الشركاء، وأعد تثبيت التطبيق على المتجر، ثم ضع access_token الجديد في SALLA_ACCESS_TOKEN وأعد النشر.",
  token_expired:
    "تم رفض رمز SALLA_ACCESS_TOKEN. تنتهي صلاحية رموز الوصول بعد 14 يومًا: ضع رمزًا جديدًا في Vercel وأعد النشر، وتأكد من تفعيل صلاحية المنتجات للتطبيق.",
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
