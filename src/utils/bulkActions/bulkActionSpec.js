/**
 * Salla "Bulk Product Actions" contract: POST /admin/v2/products/actions
 * (scope products.read_write). Source: https://docs.salla.dev/product/bulk-product-options.md
 *
 * Pure data + payload builders, shared by the UI and api/products.js (which
 * re-validates every request against this file). Nothing here is guessed:
 * action names, pricing columns, formulas, apply_on values and filter keys
 * are the ones the docs list.
 *
 * One product → Salla applies it right away. Several → Salla queues it and
 * answers `[{ operation_id, action_name, status: "in_progress" }]`. Salla
 * documents no endpoint to check an operation's status later.
 */

/** Every action_name in the docs' enum. */
export const SALLA_BULK_ACTIONS = [
  "duplicate",
  "sale-channels",
  "features",
  "notify-quantity",
  "pricing",
  "restore",
];

export const SALE_CHANNELS = ["web", "app"];

export const PRICING_COLUMNS = ["price", "sale_price", "cost_price"];

export const APPLY_ON = ["product", "product_and_variants", "variants"];

/**
 * The formulas from the docs' table, per column, exactly as written there
 * (spacing included). `id` is ours, used by the UI and the preview maths.
 */
export const PRICING_FORMULAS = {
  price: [
    { id: "price_add_amount", formula: "price + amount", unit: "amount" },
    {
      id: "price_add_percent",
      formula: "price + (price * amount /100 )",
      unit: "percent",
    },
    { id: "cost_add_amount", formula: "cost_price + amount", unit: "amount" },
    {
      id: "cost_add_percent",
      formula: "cost_price + (cost_price * amount /100 )",
      unit: "percent",
    },
    { id: "set_amount", formula: "amount", unit: "amount" },
  ],
  sale_price: [
    {
      id: "price_minus_percent",
      formula: "price - (price * amount /100 )",
      unit: "percent",
    },
    { id: "price_minus_amount", formula: "price - amount", unit: "amount" },
    {
      id: "sale_minus_percent",
      formula: "sale_price - (sale_price * amount /100 )",
      unit: "percent",
    },
    { id: "sale_minus_amount", formula: "sale_price - amount", unit: "amount" },
    { id: "cost_add_amount", formula: "cost_price + amount", unit: "amount" },
    {
      id: "cost_add_percent",
      formula: "cost_price + (cost_price * amount /100 )",
      unit: "percent",
    },
    { id: "set_amount", formula: "amount", unit: "amount" },
  ],
  cost_price: [
    { id: "cost_add_amount", formula: "cost_price + amount", unit: "amount" },
    {
      id: "cost_add_percent",
      formula: "cost_price + (cost_price * amount /100 )",
      unit: "percent",
    },
    { id: "set_amount", formula: "amount", unit: "amount" },
  ],
};

export function findFormula(column, formulaId) {
  return (PRICING_FORMULAS[column] || []).find((f) => f.id === formulaId);
}

/**
 * What a documented formula gives for one product. Mirrors the formula
 * strings above; used for the preview only (Salla does the real maths).
 * Returns null when the product lacks a value the formula needs.
 */
export function applyFormula(
  formulaId,
  amount,
  { price, salePrice, costPrice },
) {
  const a = Number(amount);
  const need = (v) => (Number.isFinite(v) ? v : null);
  switch (formulaId) {
    case "price_add_amount":
      return need(price) === null ? null : price + a;
    case "price_add_percent":
      return need(price) === null ? null : price + (price * a) / 100;
    case "price_minus_amount":
      return need(price) === null ? null : price - a;
    case "price_minus_percent":
      return need(price) === null ? null : price - (price * a) / 100;
    case "sale_minus_amount":
      return need(salePrice) === null ? null : salePrice - a;
    case "sale_minus_percent":
      return need(salePrice) === null
        ? null
        : salePrice - (salePrice * a) / 100;
    case "cost_add_amount":
      return need(costPrice) === null ? null : costPrice + a;
    case "cost_add_percent":
      return need(costPrice) === null
        ? null
        : costPrice + (costPrice * a) / 100;
    case "set_amount":
      return a;
    default:
      return null;
  }
}

const isInt = (v) => Number.isInteger(v) && v >= 0;
const ids = (list) =>
  Array.isArray(list)
    ? list.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];

/**
 * UI values → one Salla operation. Returns { operation } or { error }.
 * The same function validates on the server, so it rejects anything the
 * docs don't describe.
 */
export function buildOperation(actionName, value = {}) {
  switch (actionName) {
    case "duplicate":
    case "restore":
      return { operation: { action_name: actionName } };

    case "sale-channels": {
      const channels = Array.isArray(value.channels)
        ? [...new Set(value.channels)].filter((c) => SALE_CHANNELS.includes(c))
        : [];
      if (!channels.length) return { error: "Choose at least one channel" };
      return { operation: { action_name: actionName, value: { channels } } };
    }

    case "features": {
      const out = {};
      const categories = ids(value.categories);
      const tags = ids(value.tags);
      const brandId = Number(value.brand_id);
      if (categories.length) out.categories = categories;
      if (Number.isInteger(brandId) && brandId > 0) out.brand_id = brandId;
      if (tags.length) out.tags = tags;
      if (!Object.keys(out).length) {
        return { error: "Choose a category, brand or tag" };
      }
      return { operation: { action_name: actionName, value: out } };
    }

    case "notify-quantity": {
      const notify = Number(value.notify_quantity);
      const minimum = Number(value.minimum_notify_quantity);
      const percent = Number(value.subscribers_percentage);
      if (![notify, minimum, percent].every(isInt)) {
        return { error: "Use whole numbers of 0 or more" };
      }
      if (percent > 100) return { error: "Subscribers percentage is 0–100" };
      return {
        operation: {
          action_name: actionName,
          value: {
            notify_quantity: notify,
            minimum_notify_quantity: minimum,
            subscribers_percentage: percent,
          },
        },
      };
    }

    case "pricing": {
      const { column, formulaId, apply_on: applyOn } = value;
      const amount = Number(value.amount);
      const formula = findFormula(column, formulaId);
      if (!formula) return { error: "Unsupported pricing formula" };
      if (!APPLY_ON.includes(applyOn)) return { error: "Invalid apply_on" };
      if (!Number.isFinite(amount) || amount <= 0) {
        return { error: "Amount must be greater than 0" };
      }
      if (
        formula.unit === "percent" &&
        formula.id.includes("minus") &&
        amount >= 100
      ) {
        return { error: "A percentage decrease must be below 100%" };
      }
      return {
        operation: {
          action_name: actionName,
          value: {
            column,
            formula: formula.formula,
            amount,
            apply_on: applyOn,
          },
        },
      };
    }

    default:
      return { error: `Unsupported action: ${actionName}` };
  }
}

/** Server side: is this exact operation one the docs describe? */
export function sanitizeOperation(operation) {
  if (!operation || !SALLA_BULK_ACTIONS.includes(operation.action_name)) {
    return { error: "Unsupported action" };
  }
  const value = operation.value || {};
  if (operation.action_name === "pricing") {
    const formula = (PRICING_FORMULAS[value.column] || []).find(
      (f) => f.formula === value.formula,
    );
    if (!formula) return { error: "Unsupported pricing formula" };
    return buildOperation("pricing", { ...value, formulaId: formula.id });
  }
  return buildOperation(operation.action_name, value);
}

export const BULK_STATUS_FILTERS = ["hidden", "out", "sale", "none"];

/**
 * Selection → Salla `filters`.
 * - { mode: "ids", ids }                → the chosen products only
 * - { mode: "all", excludedIds, status, categoryId } → every product matching
 *   the list's status / category filter, minus the excluded ones
 */
export function buildFilters(selection) {
  const base = {
    select_all: false,
    unselected_ids: [],
    ids: [],
    categories: [],
    brands: [],
    status: [],
    types: [],
  };
  if (selection?.mode === "all") {
    return {
      ...base,
      select_all: true,
      unselected_ids: (selection.excludedIds || []).map(String),
      categories: selection.categoryId ? [String(selection.categoryId)] : [],
      status: BULK_STATUS_FILTERS.includes(selection.status)
        ? [selection.status]
        : [],
    };
  }
  return { ...base, ids: ids(selection?.ids) };
}

/** Server side: keep only documented filter keys with the right types. */
export function sanitizeFilters(filters = {}) {
  const strings = (list) =>
    Array.isArray(list) ? list.map(String).filter((s) => /^\d+$/.test(s)) : [];
  const clean = {
    select_all: filters.select_all === true,
    unselected_ids: strings(filters.unselected_ids),
    ids: ids(filters.ids),
    categories: strings(filters.categories),
    brands: strings(filters.brands),
    status: Array.isArray(filters.status)
      ? filters.status.filter((s) => BULK_STATUS_FILTERS.includes(s))
      : [],
    types: [],
  };
  if (!clean.select_all && !clean.ids.length) {
    return { error: "Select at least one product" };
  }
  return { filters: clean };
}
