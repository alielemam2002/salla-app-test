/**
 * Smart replenishment: remind a customer on WhatsApp shortly before a
 * product they bought runs out. Shared by the Replenish tab and the server
 * (api/replenish.js, api/salla-webhook.js), which re-validates against it.
 */

// Template variables the server can fill for one reminder.
export const REPLENISH_VARIABLES = [
  { key: "customer_name", label: "اسم العميل" },
  { key: "product_name", label: "اسم المنتج" },
  { key: "product_url", label: "رابط المنتج" },
  { key: "coupon_code", label: "كود الكوبون (إن اخترته)" },
];
export const REPLENISH_VARIABLE_KEYS = new Set(
  REPLENISH_VARIABLES.map((v) => v.key),
);

export const LEAD_OPTIONS = [
  { value: 0, label: "يوم انتهاء المدة" },
  { value: 3, label: "قبلها بـ 3 أيام" },
  { value: 5, label: "قبلها بـ 5 أيام" },
  { value: 7, label: "قبلها بـ 7 أيام" },
];

// New WhatsApp business portfolios can message 250 customers a day outside
// the customer service window.
export const DAILY_LIMIT_OPTIONS = [
  { value: 25, label: "25 رسالة" },
  { value: 50, label: "50 رسالة" },
  { value: 100, label: "100 رسالة" },
];

export const REPLENISH_DEFAULTS = {
  enabled: false,
  leadDays: 5,
  dailyLimit: 50,
  template: "",
  language: "ar",
  params: ["customer_name", "product_name", "product_url"],
  couponCode: "",
};

// Body text to create in Meta (category: Marketing). {{n}} follow `params`.
export const SAMPLE_TEMPLATE_AR = [
  "أهلاً {{1}} 👋",
  "{{2}} قرب يخلص عندك؟",
  "اطلبه مرة ثانية من هنا: {{3}}",
].join("\n");

export const MAX_CYCLE_DAYS = 365;
// Buying 3 bags lasts three times as long, up to this many units.
export const MAX_UNITS = 6;
export const DAY_MS = 24 * 60 * 60 * 1000;

// Vercel Cron "0 16 * * *" (UTC). Hobby plans start it within that hour.
export const SCHEDULE_LABEL = "مرة يوميًا بين 7 و 8 مساءً بتوقيت السعودية";

export const isCycleDays = (value) =>
  Number.isInteger(value) && value >= 1 && value <= MAX_CYCLE_DAYS;

/**
 * When to remind: the product lasts `days` per unit bought (up to
 * MAX_UNITS), and the reminder goes `leadDays` before that, at least one
 * day after the order.
 */
export function reminderDueAt(orderedAt, days, quantity, leadDays) {
  const units = Math.min(
    Math.max(1, Math.floor(Number(quantity) || 1)),
    MAX_UNITS,
  );
  const remindInDays = Math.max(1, days * units - (Number(leadDays) || 0));
  return orderedAt + remindInDays * DAY_MS;
}

export const STATUS_LABELS = {
  scheduled: "مجدول",
  sent: "أُرسل",
  failed: "فشل",
  cancelled: "أُلغي",
  superseded: "اشترى مرة أخرى",
  skipped: "تم تخطيه",
};

const dateFormat = new Intl.DateTimeFormat("ar", {
  day: "numeric",
  month: "short",
  numberingSystem: "latn",
});

/** "12 أكتوبر" (Western digits). */
export const formatDay = (ms) => dateFormat.format(ms);

/** "بعد 5 أيام", "غدًا", "اليوم" for a due time. */
export function dueLabel(ms, now = Date.now()) {
  const days = Math.ceil((ms - now) / DAY_MS);
  if (days <= 0) return "اليوم";
  if (days === 1) return "غدًا";
  if (days === 2) return "بعد يومين";
  return `بعد ${days} ${days <= 10 ? "أيام" : "يومًا"}`;
}
