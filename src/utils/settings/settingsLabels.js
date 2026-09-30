/** Arabic labels for store details and WhatsApp templates (Settings tab). */

export const PLAN_LABELS = {
  basic: "الأساسية",
  plus: "بلس",
  pro: "برو",
  special: "سبيشال",
};

export const ENTITY_LABELS = {
  company: "شركة",
  individual: "فرد",
  person: "فرد",
  charity: "جمعية خيرية",
};

export const STORE_STATUS = {
  active: { label: "نشط", tone: "success" },
  inactive: { label: "غير نشط", tone: "neutral" },
  suspended: { label: "موقوف", tone: "danger" },
};

// Meta template status → badge.
export const TEMPLATE_STATUS = {
  APPROVED: { label: "معتمد", tone: "success" },
  PENDING: { label: "قيد المراجعة", tone: "warning" },
  IN_REVIEW: { label: "قيد المراجعة", tone: "warning" },
  REJECTED: { label: "مرفوض", tone: "danger" },
  PAUSED: { label: "متوقف مؤقتًا", tone: "warning" },
  DISABLED: { label: "معطّل", tone: "neutral" },
};

export const TEMPLATE_CATEGORY = {
  MARKETING: "تسويقي",
  UTILITY: "خدمي",
  AUTHENTICATION: "تحقق",
};

const dateFormat = new Intl.DateTimeFormat("ar", {
  dateStyle: "medium",
  numberingSystem: "latn",
});

/** "2021-08-11 12:15:24" or ISO → "11 أغسطس 2021" (Western digits). */
export function formatDate(value) {
  if (!value) return null;
  const ms = Date.parse(String(value).replace(" ", "T"));
  return Number.isFinite(ms) ? dateFormat.format(ms) : String(value);
}
