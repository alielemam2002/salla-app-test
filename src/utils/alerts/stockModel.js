/**
 * Stock alerts: when a product counts as out of stock or running low.
 * Shared by the Alerts tab and the server (api/stock-alerts.js,
 * api/salla-webhook.js).
 */

export const THRESHOLD_OPTIONS = [
  { value: 0, label: "عند النفاد فقط" },
  { value: 1, label: "قطعة واحدة أو أقل" },
  { value: 3, label: "3 قطع أو أقل" },
  { value: 5, label: "5 قطع أو أقل" },
  { value: 10, label: "10 قطع أو أقل" },
  { value: 20, label: "20 قطعة أو أقل" },
];
export const DEFAULT_THRESHOLD = 5;

export const isThreshold = (value) =>
  THRESHOLD_OPTIONS.some((o) => o.value === value);

/**
 * "out" | "low" | null for a Salla product. Unlimited stock never alerts,
 * and a product without a quantity (not tracked) only alerts when Salla
 * marks it out of stock.
 */
export function stockLevel(product, threshold) {
  if (!product || product.unlimited_quantity) return null;
  const raw = product.quantity;
  const quantity =
    raw === null || raw === undefined || raw === "" ? null : Number(raw);
  if (product.status === "out") return "out";
  if (quantity === null || !Number.isFinite(quantity)) return null;
  if (quantity <= 0) return "out";
  return quantity <= threshold ? "low" : null;
}

/** "نفد من المخزون" or "باقي 3". */
export function stockLabel(level, quantity) {
  if (level === "out") return "نفد من المخزون";
  return `باقي ${quantity}`;
}
