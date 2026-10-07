/**
 * Pure helpers for Salla coupon objects (GET /admin/v2/coupons).
 *
 * Dates: Salla returns `start_date` / `expiry_date` as "YYYY-MM-DD HH:MM:SS"
 * without an offset. Its `created_at` objects carry timezone "Asia/Riyadh",
 * so these wall-clock values are read as store time (UTC+03:00, no DST).
 */

export const STORE_UTC_OFFSET = "+03:00";

export const COUPON_STATUS = {
  ACTIVE: "active",
  SCHEDULED: "scheduled",
  EXPIRED: "expired",
  DISABLED: "disabled",
};

export const STATUS_META = {
  active: { label: "نشط", tone: "success" },
  scheduled: { label: "مجدول", tone: "info" },
  expired: { label: "منتهي", tone: "neutral" },
  disabled: { label: "معطّل", tone: "warning" },
};

/** "2026-03-17 00:00:00" | "2026-03-17" → epoch ms (store time), or null. */
export function parseSallaDate(value) {
  if (!value || typeof value !== "string") return null;
  const match = value
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;
  const [, day, hh = "00", mm = "00", ss = "00"] = match;
  const ms = Date.parse(`${day}T${hh}:${mm}:${ss}${STORE_UTC_OFFSET}`);
  return Number.isNaN(ms) ? null : ms;
}

/** Status shown to the merchant, derived from Salla's status + dates. */
export function getCouponStatus(coupon, now = Date.now()) {
  if (coupon?.status && coupon.status !== "active") {
    return COUPON_STATUS.DISABLED;
  }
  const start = parseSallaDate(coupon?.start_date);
  const end = parseSallaDate(coupon?.expiry_date);
  if (start !== null && now < start) return COUPON_STATUS.SCHEDULED;
  if (end !== null && now >= end) return COUPON_STATUS.EXPIRED;
  return COUPON_STATUS.ACTIVE;
}

/** Epoch ms of the countdown target (start for scheduled, end for active). */
export function getCountdownTarget(coupon, status) {
  if (status === COUPON_STATUS.SCHEDULED)
    return parseSallaDate(coupon.start_date);
  if (status === COUPON_STATUS.ACTIVE)
    return parseSallaDate(coupon.expiry_date);
  return null;
}

/** The next moment any coupon changes status, or null. */
export function nextStatusChange(coupons, now = Date.now()) {
  let next = null;
  for (const coupon of coupons) {
    const target = getCountdownTarget(coupon, getCouponStatus(coupon, now));
    if (target !== null && target > now && (next === null || target < next)) {
      next = target;
    }
  }
  return next;
}

/** Salla sends money either as a number or as { amount, currency }. */
export function moneyValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const raw = typeof value === "object" ? value.amount : value;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

export function moneyCurrency(...values) {
  for (const value of values) {
    if (value && typeof value === "object" && value.currency)
      return value.currency;
  }
  return "SAR";
}

const formatNumber = (n) =>
  Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");

/** "خصم 20%" / "خصم 30 SAR" */
export function formatDiscount(coupon) {
  const amount = moneyValue(coupon?.amount);
  if (amount === null) return "—";
  return String(coupon.type).toLowerCase().startsWith("p")
    ? `خصم ${formatNumber(amount)}%`
    : `خصم ${formatNumber(amount)} ${moneyCurrency(coupon.amount)}`;
}

const isEmptyList = (list) => !Array.isArray(list) || list.length === 0;

const PRODUCT_SCOPE_LISTS = [
  "include_product_ids",
  "exclude_product_ids",
  "include_category_ids",
  "exclude_category_ids",
  "exclude_brands_ids",
];

/** True when the discount applies to every product in the store. */
export function isStorewide(coupon) {
  return PRODUCT_SCOPE_LISTS.every((key) => isEmptyList(coupon?.[key]));
}

/**
 * Settings this page can't edit. Salla's update is a PUT, so saving from
 * this form could drop them; those coupons must be edited in the dashboard.
 */
export function getUnmanagedSettings(coupon) {
  const reasons = [];
  const hasOtherProductScope = [
    "exclude_product_ids",
    "include_category_ids",
    "exclude_category_ids",
    "exclude_brands_ids",
  ].some((key) => !isEmptyList(coupon?.[key]));
  if (hasOtherProductScope)
    reasons.push("شروط المنتجات أو التصنيفات أو الماركات");
  if (
    !isEmptyList(coupon?.include_customer_group_ids) ||
    !isEmptyList(coupon?.exclude_customer_group_ids) ||
    !isEmptyList(coupon?.include_customer_ids) ||
    coupon?.beneficiary_domain
  ) {
    reasons.push("قيود العملاء");
  }
  if (!isEmptyList(coupon?.exclude_shipping_ids))
    reasons.push("استثناءات الشحن");
  const payments = coupon?.include_payment_methods;
  if (
    !isEmptyList(payments) &&
    !(payments.length === 1 && payments[0] === "all")
  ) {
    reasons.push("شروط طرق الدفع");
  }
  if (coupon?.applied_in && coupon.applied_in !== "all")
    reasons.push("الموقع أو التطبيق فقط");
  if (coupon?.is_group) reasons.push("كوبون مجموعة");
  if (coupon?.marketing_active) reasons.push("إعدادات المسوّقين");
  return reasons;
}

/** { used, limit } — `used` is null when Salla didn't send statistics. */
export function getUsage(coupon) {
  const used = coupon?.statistics?.num_of_usage;
  const limit = coupon?.usage_limit;
  return {
    used: typeof used === "number" ? used : null,
    limit: typeof limit === "number" && limit > 0 ? limit : null,
  };
}

/** Case-insensitive match on the coupon code. */
export function matchesSearch(coupon, query) {
  const q = query.trim().toLowerCase();
  return (
    !q ||
    String(coupon?.code || "")
      .toLowerCase()
      .includes(q)
  );
}
