import { moneyValue, parseSallaDate } from "./couponModel.js";

const STORE_OFFSET_MS = 3 * 60 * 60 * 1000; // Asia/Riyadh, see couponModel.js

export const EMPTY_COUPON_FORM = {
  code: "",
  type: "percentage",
  amount: "",
  maximum_amount: "",
  minimum_amount: "",
  start_date: "",
  expiry_date: "",
  usage_limit: "",
  usage_limit_per_user: "",
  free_shipping: false,
  exclude_sale_products: false,
  active: true,
};

/** "2026-03-17 08:30:00" → "2026-03-17T08:30" (datetime-local value). */
export function sallaDateToInput(value) {
  const match = String(value || "").match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/,
  );
  if (match) return `${match[1]}T${match[2]}`;
  const dayOnly = String(value || "").match(/^(\d{4}-\d{2}-\d{2})$/);
  return dayOnly ? `${dayOnly[1]}T00:00` : "";
}

/** "2026-03-17T08:30" → "2026-03-17 08:30:00" (Salla format). */
export function inputDateToSalla(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}:00` : "";
}

/** Today's date in store time, "YYYY-MM-DD". */
export function storeToday(now = Date.now()) {
  return new Date(now + STORE_OFFSET_MS).toISOString().slice(0, 10);
}

const numberText = (value) => {
  const num = moneyValue(value);
  return num === null || num === 0 ? "" : String(num);
};

export function couponToForm(coupon) {
  if (!coupon) return { ...EMPTY_COUPON_FORM };
  return {
    code: coupon.code || "",
    type: String(coupon.type || "")
      .toLowerCase()
      .startsWith("f")
      ? "fixed"
      : "percentage",
    amount: numberText(coupon.amount),
    maximum_amount: numberText(coupon.maximum_amount),
    minimum_amount: numberText(coupon.minimum_amount),
    start_date: sallaDateToInput(coupon.start_date),
    expiry_date: sallaDateToInput(coupon.expiry_date),
    usage_limit: coupon.usage_limit ? String(coupon.usage_limit) : "",
    usage_limit_per_user: coupon.usage_limit_per_user
      ? String(coupon.usage_limit_per_user)
      : "",
    free_shipping: Boolean(coupon.free_shipping),
    exclude_sale_products: Boolean(coupon.is_sale_products_exclude),
    active: (coupon.status || "active") === "active",
  };
}

const isBlank = (v) => v === undefined || v === null || String(v).trim() === "";
const isPositiveInt = (v) => /^\d+$/.test(String(v).trim()) && Number(v) > 0;

/**
 * Client-side checks that mirror Salla's documented rules. Returns an object
 * of field → message (empty when valid). Salla still has the final say.
 */
export function validateCouponForm(form, now = Date.now()) {
  const errors = {};
  const code = form.code.trim();
  if (!code) errors.code = "Coupon code is required";
  else if (/\s/.test(code)) errors.code = "Coupon code can't contain spaces";

  const amount = Number(form.amount);
  if (isBlank(form.amount)) errors.amount = "Discount is required";
  else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Discount must be greater than 0";
  } else if (form.type === "percentage" && amount > 100) {
    errors.amount = "A percentage discount can't exceed 100%";
  }

  if (form.type === "percentage") {
    const max = Number(form.maximum_amount);
    if (isBlank(form.maximum_amount)) {
      errors.maximum_amount =
        "Salla requires a maximum discount for percentage coupons";
    } else if (!Number.isFinite(max) || max <= 0) {
      errors.maximum_amount = "Maximum discount must be greater than 0";
    }
  }

  if (!isBlank(form.minimum_amount)) {
    const min = Number(form.minimum_amount);
    if (!Number.isFinite(min) || min < 0) {
      errors.minimum_amount = "Minimum order must be 0 or more";
    }
  }

  const expiry = inputDateToSalla(form.expiry_date);
  if (!expiry) errors.expiry_date = "End date is required";
  else if (expiry.slice(0, 10) <= storeToday(now)) {
    errors.expiry_date =
      "Salla requires the end date to be at least one day after today";
  }

  const start = inputDateToSalla(form.start_date);
  if (form.start_date && !start) errors.start_date = "Invalid start date";
  else if (start && expiry && parseSallaDate(start) >= parseSallaDate(expiry)) {
    errors.start_date = "Start date must be before the end date";
  }

  if (!isBlank(form.usage_limit) && !isPositiveInt(form.usage_limit)) {
    errors.usage_limit = "Use a whole number greater than 0";
  }
  if (!isBlank(form.usage_limit_per_user)) {
    if (!isPositiveInt(form.usage_limit_per_user)) {
      errors.usage_limit_per_user = "Use a whole number greater than 0";
    } else if (
      isPositiveInt(form.usage_limit) &&
      Number(form.usage_limit_per_user) > Number(form.usage_limit)
    ) {
      errors.usage_limit_per_user = "Can't be more than the total usage limit";
    }
  }
  return errors;
}

/** Form state → the `coupon` object api/coupons.js expects. */
export function formToCouponInput(form) {
  const optionalNumber = (v) => (isBlank(v) ? undefined : Number(v));
  return {
    code: form.code.trim(),
    type: form.type,
    amount: Number(form.amount),
    maximum_amount:
      form.type === "percentage" ? Number(form.maximum_amount) : undefined,
    minimum_amount: optionalNumber(form.minimum_amount),
    start_date: inputDateToSalla(form.start_date) || undefined,
    expiry_date: inputDateToSalla(form.expiry_date),
    usage_limit: optionalNumber(form.usage_limit),
    usage_limit_per_user: optionalNumber(form.usage_limit_per_user),
    free_shipping: form.free_shipping,
    exclude_sale_products: form.exclude_sale_products,
    status: form.active ? "active" : "inactive",
  };
}
