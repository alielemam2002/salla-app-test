/**
 * Pure helpers for Salla abandoned carts (GET /carts/abandoned).
 *
 * A cart is abandoned by Salla's own definition once it appears in that
 * list. The "abandoned after" threshold here only narrows it further using
 * Salla's `age_in_minutes`; it never adds carts Salla doesn't list.
 */

export const ABANDONED_AFTER_OPTIONS = [
  { value: 30, label: "30 دقيقة" },
  { value: 60, label: "ساعة" },
  { value: 180, label: "3 ساعات" },
  { value: 360, label: "6 ساعات" },
  { value: 720, label: "12 ساعة" },
  { value: 1440, label: "24 ساعة" },
];
export const DEFAULT_ABANDONED_AFTER = 60;

/** Salla money ({ amount, currency } or a number) → { amount, currency }. */
export function money(value, fallbackCurrency = "SAR") {
  if (value && typeof value === "object") {
    const amount = Number(value.amount);
    return {
      amount: Number.isFinite(amount) ? amount : 0,
      currency: value.currency || fallbackCurrency,
    };
  }
  const amount = Number(value);
  return {
    amount: Number.isFinite(amount) ? amount : 0,
    currency: fallbackCurrency,
  };
}

const numberFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

export function formatMoney({ amount, currency }) {
  return `${currency} ${numberFormat.format(amount)}`;
}

export function itemCount(cart) {
  return (cart?.items || []).reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );
}

// Salla store times come as { date: "2025-01-21 17:09:39.000000",
// timezone: "Asia/Riyadh" }. Riyadh has no DST, so it is always +03:00.
const OFFSETS = { "Asia/Riyadh": "+03:00", UTC: "Z" };

/** Salla date object (or string) → epoch ms, or null. */
export function sallaDateMs(value) {
  const raw = typeof value === "object" ? value?.date : value;
  const match = String(raw || "").match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/,
  );
  if (!match) return null;
  const zone =
    typeof value === "object"
      ? value?.timezone || "Asia/Riyadh"
      : "Asia/Riyadh";
  const offset = OFFSETS[zone] || "+03:00";
  const ms = Date.parse(`${match[1]}T${match[2]}${offset}`);
  return Number.isNaN(ms) ? null : ms;
}

/** Arabic count phrase: "دقيقة", "دقيقتان", "5 دقائق", "12 دقيقة". */
function arabicCount(n, [one, two, few, many]) {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${n >= 3 && n <= 10 ? few : many}`;
}

/** "الآن", "قبل 5 دقائق", "قبل ساعتين", "قبل 3 أيام". */
export function timeAgo(ms, now = Date.now()) {
  if (ms === null || ms === undefined) return "—";
  const minutes = Math.max(0, Math.round((now - ms) / 60000));
  if (minutes < 1) return "الآن";
  if (minutes < 60) {
    return `قبل ${arabicCount(minutes, ["دقيقة", "دقيقتين", "دقائق", "دقيقة"])}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `قبل ${arabicCount(hours, ["ساعة", "ساعتين", "ساعات", "ساعة"])}`;
  }
  const days = Math.floor(hours / 24);
  return `قبل ${arabicCount(days, ["يوم", "يومين", "أيام", "يومًا"])}`;
}

/** Old enough to count as abandoned under the chosen threshold. */
export function isEligible(cart, abandonedAfter) {
  return Number(cart?.age_in_minutes) >= abandonedAfter;
}

/**
 * Dashboard numbers from the loaded carts. Revenue is grouped by currency
 * rather than mixing currencies into one total.
 */
export function summarizeCarts(carts, abandonedAfter) {
  const eligible = carts.filter((cart) => isEligible(cart, abandonedAfter));
  const revenue = {};
  eligible.forEach((cart) => {
    const { amount, currency } = money(cart.total);
    revenue[currency] = (revenue[currency] || 0) + amount;
  });
  return {
    total: carts.length,
    eligible: eligible.length,
    withPhone: eligible.filter((cart) => cart.customer?.mobile).length,
    revenue: Object.entries(revenue).map(([currency, amount]) => ({
      currency,
      amount: Math.round(amount * 100) / 100,
    })),
  };
}

/** Failed carts request → message the merchant can act on. */
export function describeCartsError(result = {}) {
  const { status, code } = result;
  if (code === "network_error" || status === 0) {
    return "تعذّر الاتصال بالإنترنت. تحقق من اتصالك ثم حاول مرة أخرى.";
  }
  if (code === "session_invalid") {
    return "انتهت جلسة سلة. حدّث الصفحة ثم حاول مرة أخرى.";
  }
  if (code === "token_not_configured") {
    return "لم يتم إعداد رمز الوصول لواجهة سلة (SALLA_ACCESS_TOKEN) على الخادم.";
  }
  if (code === "missing_scope" || status === 403) {
    return "يحتاج التطبيق إلى صلاحية carts.read (قراءة السلات المتروكة). أضفها من بوابة الشركاء، ثم أعد تثبيت التطبيق وضع رمز الوصول الجديد في SALLA_ACCESS_TOKEN.";
  }
  if (code === "token_expired" || status === 401) {
    return "رمز الوصول لواجهة سلة غير صالح أو منتهي. استبدل قيمة SALLA_ACCESS_TOKEN.";
  }
  if (status === 404) return "هذه السلة لم تعد موجودة.";
  if (status === 429) {
    return "عدد الطلبات إلى سلة كبير جدًا. انتظر دقيقة ثم حاول مرة أخرى.";
  }
  if (status >= 500) return "حدثت مشكلة مؤقتة في سلة. حاول لاحقًا.";
  return "حدث خطأ ما. حاول مرة أخرى.";
}
