import { storeAccessMessage } from "../sallaAccess.js";
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
    label: "تعديل السعر",
    title: "تعديل الأسعار جماعيًا",
    primary: true,
  },
  categories: {
    key: "categories",
    actionName: "features",
    field: "categories",
    label: "التصنيفات",
    title: "تعيين التصنيفات",
    primary: true,
  },
  brand: {
    key: "brand",
    actionName: "features",
    field: "brand_id",
    label: "العلامة التجارية",
    title: "تعيين العلامة التجارية",
    primary: true,
  },
  tags: {
    key: "tags",
    actionName: "features",
    field: "tags",
    label: "الوسوم",
    title: "تعيين الوسوم",
    primary: true,
  },
  channels: {
    key: "channels",
    actionName: "sale-channels",
    label: "قنوات البيع",
    title: "قنوات البيع",
  },
  notify: {
    key: "notify",
    actionName: "notify-quantity",
    label: "تنبيه المخزون",
    title: "تنبيه المخزون",
  },
  duplicate: {
    key: "duplicate",
    actionName: "duplicate",
    label: "تكرار",
    title: "تكرار المنتجات",
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
  price: "السعر",
  sale_price: "سعر التخفيض",
  cost_price: "سعر التكلفة",
};

export const APPLY_ON_LABELS = {
  product: "المنتجات فقط",
  product_and_variants: "المنتجات ومتغيراتها",
  variants: "المتغيرات فقط",
};

/** Plain-language names for the documented formulas, per column. */
export const FORMULA_LABELS = {
  price: {
    price_add_percent: "زيادة السعر بنسبة مئوية",
    price_add_amount: "زيادة السعر بمبلغ ثابت",
    cost_add_percent: "السعر = التكلفة + نسبة مئوية",
    cost_add_amount: "السعر = التكلفة + مبلغ ثابت",
    set_amount: "تحديد سعر جديد",
  },
  sale_price: {
    price_minus_percent: "خصم: السعر − نسبة مئوية",
    price_minus_amount: "خصم: السعر − مبلغ ثابت",
    sale_minus_percent: "خفض سعر التخفيض الحالي بنسبة مئوية",
    sale_minus_amount: "خفض سعر التخفيض الحالي بمبلغ ثابت",
    cost_add_percent: "سعر التخفيض = التكلفة + نسبة مئوية",
    cost_add_amount: "سعر التخفيض = التكلفة + مبلغ ثابت",
    set_amount: "تحديد سعر تخفيض جديد",
  },
  cost_price: {
    cost_add_percent: "زيادة التكلفة بنسبة مئوية",
    cost_add_amount: "زيادة التكلفة بمبلغ ثابت",
    set_amount: "تحديد تكلفة جديدة",
  },
};

export const CHANNEL_LABELS = { web: "المتجر الإلكتروني", app: "تطبيق الجوال" };

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
      return `التصنيفات: ${names(value.categories, lookups.categories)}`;
    case "brand":
      return `العلامة التجارية: ${names([value.brand_id], lookups.brands)}`;
    case "tags":
      return `الوسوم: ${names(value.tags, lookups.tags)}`;
    case "channels":
      return `قنوات البيع: ${value.channels.map((c) => CHANNEL_LABELS[c] || c).join(" + ")}`;
    case "notify":
      return `التنبيه عند ${value.notify_quantity}، الحد الأدنى ${value.minimum_notify_quantity}، ${value.subscribers_percentage}% من المشتركين`;
    case "duplicate":
      return "تكرار كل منتج";
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
  missing: "لا توجد قيمة لحساب السعر الجديد",
  negative: "لا يمكن أن يكون السعر الجديد سالبًا",
  zero: "سيصبح السعر الجديد صفرًا",
  not_below_price: "يجب أن يكون سعر التخفيض أقل من السعر",
};

/** Problems that block submitting (the rest are warnings). */
export const BLOCKING_PROBLEMS = new Set(["negative", "zero"]);

/** Salla / network failure → short message; raw detail kept for debugging. */
export function describeBulkError(result = {}) {
  const { status, code } = result;
  let reason;
  if (code === "network_error" || status === 0) {
    reason = "مشكلة في الاتصال. تحقق من الإنترنت وحاول مرة أخرى.";
  } else if (code === "session_invalid") {
    reason = "انتهت جلستك في سلة. حدّث الصفحة وحاول مرة أخرى.";
  } else if (storeAccessMessage(code)) {
    reason = storeAccessMessage(code);
  } else if (code === "missing_scope" || status === 403) {
    reason =
      "يحتاج التطبيق إلى صلاحية products.read_write لتنفيذ الإجراءات الجماعية.";
  } else if (code === "token_expired" || status === 401) {
    reason = "لم تقبل سلة رمز وصول التطبيق، وقد تكون صلاحيته انتهت.";
  } else if (status === 422) {
    reason = "رفضت سلة الإعدادات المطلوبة لهذا الإجراء.";
  } else if (status === 429) {
    reason = "عدد الطلبات إلى سلة كبير. انتظر دقيقة ثم حاول مرة أخرى.";
  } else if (status >= 500) {
    reason = "حدثت مشكلة مؤقتة لدى سلة. حاول لاحقًا.";
  } else {
    reason = "حدث خطأ ما. حاول مرة أخرى.";
  }
  const fields = result.fields
    ? Object.entries(result.fields)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`)
        .join("\n")
    : "";
  return {
    title: "تعذّر تطبيق هذا الإجراء.",
    reason,
    debug: [result.error, fields].filter(Boolean).join("\n") || null,
  };
}
