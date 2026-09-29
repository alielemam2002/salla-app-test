import { applyFormula, findFormula } from "./bulkActionSpec.js";

/**
 * UI actions shown in the Products selection bar, each mapped to a Salla
 * action_name. Categories, Brand and Tags are all the documented `features`
 * action with a different field. `restore` (trashed products) is left out:
 * this page never lists trashed products, so there is nothing to select.
 */
export const BULK_UI_ACTIONS = {
  pricing: {
    key: "pricing",
    actionName: "pricing",
    label: "Edit Price",
    title: "Bulk Pricing",
    primary: true,
  },
  categories: {
    key: "categories",
    actionName: "features",
    field: "categories",
    label: "Categories",
    title: "Set Categories",
    primary: true,
  },
  brand: {
    key: "brand",
    actionName: "features",
    field: "brand_id",
    label: "Brand",
    title: "Set Brand",
    primary: true,
  },
  tags: {
    key: "tags",
    actionName: "features",
    field: "tags",
    label: "Tags",
    title: "Set Tags",
    primary: true,
  },
  channels: {
    key: "channels",
    actionName: "sale-channels",
    label: "Sale Channels",
    title: "Sale Channels",
  },
  notify: {
    key: "notify",
    actionName: "notify-quantity",
    label: "Stock Notification",
    title: "Stock Notification",
  },
  duplicate: {
    key: "duplicate",
    actionName: "duplicate",
    label: "Duplicate",
    title: "Duplicate Products",
    danger: true,
  },
};

export const PRIMARY_ACTIONS = Object.values(BULK_UI_ACTIONS).filter(
  (a) => a.primary,
);
export const MORE_ACTIONS = Object.values(BULK_UI_ACTIONS).filter(
  (a) => !a.primary,
);

export const COLUMN_LABELS = {
  price: "Price",
  sale_price: "Sale Price",
  cost_price: "Cost Price",
};

export const APPLY_ON_LABELS = {
  product: "Products only",
  product_and_variants: "Products and their variants",
  variants: "Variants only",
};

/** Plain-language names for the documented formulas, per column. */
export const FORMULA_LABELS = {
  price: {
    price_add_percent: "Increase price by %",
    price_add_amount: "Increase price by a fixed amount",
    cost_add_percent: "Set price to cost + %",
    cost_add_amount: "Set price to cost + fixed amount",
    set_amount: "Set a new price",
  },
  sale_price: {
    price_minus_percent: "Discount: price − %",
    price_minus_amount: "Discount: price − fixed amount",
    sale_minus_percent: "Lower current sale price by %",
    sale_minus_amount: "Lower current sale price by a fixed amount",
    cost_add_percent: "Set sale price to cost + %",
    cost_add_amount: "Set sale price to cost + fixed amount",
    set_amount: "Set a new sale price",
  },
  cost_price: {
    cost_add_percent: "Increase cost by %",
    cost_add_amount: "Increase cost by a fixed amount",
    set_amount: "Set a new cost",
  },
};

export const PREVIEW_LIMIT = 10;

export const DEFAULT_VALUES = {
  pricing: {
    column: "sale_price",
    formulaId: "price_minus_percent",
    amount: "",
    apply_on: "product",
  },
  categories: { categories: [] },
  brand: { brand_id: "" },
  tags: { tags: [] },
  channels: { channels: ["web", "app"] },
  notify: {
    notify_quantity: "",
    minimum_notify_quantity: "",
    subscribers_percentage: "",
  },
  duplicate: {},
};

/** One-line summary of what will be sent, for the review step and the log. */
export function describeAction(uiAction, value, lookups = {}) {
  const names = (ids, list) =>
    ids
      .map((id) => list?.find((x) => String(x.id) === String(id))?.name || id)
      .join(", ");
  switch (uiAction.key) {
    case "pricing": {
      const formula = findFormula(value.column, value.formulaId);
      const unit = formula?.unit === "percent" ? "%" : "";
      return `${FORMULA_LABELS[value.column]?.[value.formulaId]} (${value.amount}${unit}) · ${APPLY_ON_LABELS[value.apply_on]}`;
    }
    case "categories":
      return `Categories: ${names(value.categories, lookups.categories)}`;
    case "brand":
      return `Brand: ${names([value.brand_id], lookups.brands)}`;
    case "tags":
      return `Tags: ${names(value.tags, lookups.tags)}`;
    case "channels":
      return `Sale channels: ${value.channels.join(" + ")}`;
    case "notify":
      return `Notify at ${value.notify_quantity}, minimum ${value.minimum_notify_quantity}, ${value.subscribers_percentage}% of subscribers`;
    case "duplicate":
      return "Duplicate each product";
    default:
      return uiAction.label;
  }
}

/** Form values → the value object bulkActionSpec.buildOperation expects. */
export function formToActionValue(uiAction, form) {
  switch (uiAction.key) {
    case "pricing":
      return { ...form, amount: Number(form.amount) };
    case "notify":
      return {
        notify_quantity: Number(form.notify_quantity),
        minimum_notify_quantity: Number(form.minimum_notify_quantity),
        subscribers_percentage: Number(form.subscribers_percentage),
      };
    default:
      return form;
  }
}

// Salla sends prices as numbers or { amount, currency }.
const priceOf = (product, key) => {
  const raw = product?.[key];
  const value = Number(typeof raw === "object" ? raw?.amount : raw);
  return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * Estimated prices for a sample of the selected products (never loads more
 * products). Flags values Salla would store as negative or zero, and sale
 * prices that aren't below the price.
 */
export function buildPricingPreview(products, value) {
  return products.slice(0, PREVIEW_LIMIT).map((product) => {
    const prices = {
      price: priceOf(product, "regular_price") ?? priceOf(product, "price"),
      salePrice: priceOf(product, "sale_price"),
      costPrice: priceOf(product, "cost_price"),
    };
    const currentKey = {
      price: "price",
      sale_price: "salePrice",
      cost_price: "costPrice",
    }[value.column];
    const next = applyFormula(value.formulaId, value.amount, prices);
    const rounded = next === null ? null : Math.round(next * 100) / 100;

    let problem = null;
    if (rounded === null) problem = "missing";
    else if (rounded < 0) problem = "negative";
    else if (rounded === 0) problem = "zero";
    else if (
      value.column === "sale_price" &&
      prices.price !== null &&
      rounded >= prices.price
    ) {
      problem = "not_below_price";
    }

    return {
      id: product.id,
      name: product.name,
      price: prices.price,
      current: prices[currentKey],
      next: rounded,
      problem,
    };
  });
}

export const PREVIEW_PROBLEMS = {
  missing: "No value to calculate from",
  negative: "New price cannot be negative",
  zero: "New price would be 0",
  not_below_price: "Sale price must be below the price",
};

/** Problems that block submitting (the rest are warnings). */
export const BLOCKING_PROBLEMS = new Set(["negative", "zero"]);

/** Salla / network failure → short message; raw detail kept for debugging. */
export function describeBulkError(result = {}) {
  const { status, code } = result;
  let reason;
  if (code === "network_error" || status === 0) {
    reason = "Network problem. Check your connection and try again.";
  } else if (code === "session_invalid") {
    reason = "Your Salla session expired. Refresh the page and try again.";
  } else if (code === "token_not_configured") {
    reason =
      "The store's access token (SALLA_ACCESS_TOKEN) isn't set on the server.";
  } else if (code === "missing_scope" || status === 403) {
    reason = "The app needs the products.read_write scope for bulk actions.";
  } else if (code === "token_expired" || status === 401) {
    reason = "Salla didn't accept the app's access token. It may have expired.";
  } else if (status === 422) {
    reason = "Salla rejected the requested settings for this action.";
  } else if (status === 429) {
    reason = "Too many requests to Salla. Wait a minute and try again.";
  } else if (status >= 500) {
    reason = "Salla had a temporary problem. Try again later.";
  } else {
    reason = "Something went wrong. Try again.";
  }
  const fields = result.fields
    ? Object.entries(result.fields)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
        .join("\n")
    : "";
  return {
    title: "Unable to apply this action.",
    reason,
    debug: [result.error, fields].filter(Boolean).join("\n") || null,
  };
}
