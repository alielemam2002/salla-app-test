/**
 * Pure helpers for Salla abandoned carts (GET /carts/abandoned).
 *
 * A cart is abandoned by Salla's own definition once it appears in that
 * list. The "abandoned after" threshold here only narrows it further using
 * Salla's `age_in_minutes`; it never adds carts Salla doesn't list.
 */

export const ABANDONED_AFTER_OPTIONS = [
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 180, label: "3 hours" },
  { value: 360, label: "6 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "24 hours" },
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

/** "5 min ago", "2h ago", "3d ago". */
export function timeAgo(ms, now = Date.now()) {
  if (ms === null || ms === undefined) return "—";
  const minutes = Math.max(0, Math.round((now - ms) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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
    return "Network problem. Check your connection and try again.";
  }
  if (code === "session_invalid") {
    return "Your Salla session has expired. Refresh the session and try again.";
  }
  if (code === "token_not_configured") {
    return "The store's API access token (SALLA_ACCESS_TOKEN) is not configured on the server.";
  }
  if (code === "missing_scope" || status === 403) {
    return "The app needs the carts.read scope (Carts Read Only). Add it in the Partners Portal, reinstall the app, and put the new access token in SALLA_ACCESS_TOKEN.";
  }
  if (code === "token_expired" || status === 401) {
    return "The store's API access token is invalid or expired. Replace SALLA_ACCESS_TOKEN.";
  }
  if (status === 404) return "This cart no longer exists.";
  if (status === 429) {
    return "Too many requests to Salla. Wait a minute and try again.";
  }
  if (status >= 500) return "Salla had a temporary problem. Try again later.";
  return "Something went wrong. Try again.";
}
