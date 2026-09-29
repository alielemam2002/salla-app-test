/**
 * Storefront announcement bar for a coupon. Only one bar can be shown at a
 * time (it lives in the app's flat settings), so turning it on for one coupon
 * replaces the bar of any other coupon.
 */

export const BAR_TEXT_MAX = 200;

// Salla primary on white reads well on most themes.
export const BAR_DEFAULTS = {
  bar_enabled: false,
  bar_text: "",
  bar_bg_color: "#004d5b",
  bar_text_color: "#ffffff",
};

const CURRENCY_AR = { SAR: "ر.س" };

/** Arabic default text, e.g. "استخدم كود SUMMER20 واحصل على خصم 20%". */
export function defaultBarText(input, currency = "SAR") {
  const code = String(input?.code || "").trim() || "COUPON";
  const amount = Number(input?.amount);
  const hasAmount = Number.isFinite(amount) && amount > 0;
  let discount = "";
  if (hasAmount) {
    discount =
      input?.type === "fixed"
        ? `خصم ${amount} ${CURRENCY_AR[currency] || currency}`
        : `خصم ${amount}%`;
  }
  const shipping = input?.free_shipping ? " + شحن مجاني" : "";
  return discount
    ? `استخدم كود ${code} واحصل على ${discount}${shipping}`
    : `استخدم كود ${code}${shipping}`;
}

/** Is the live storefront bar this coupon's? */
export function isBarFor(bar, code) {
  return Boolean(bar && code && bar.code === code);
}

/** Bar fields for the coupon form, prefilled from the live bar when it's this coupon's. */
export function barToForm(bar, coupon) {
  if (!coupon || !isBarFor(bar, coupon.code)) return { ...BAR_DEFAULTS };
  return {
    bar_enabled: true,
    bar_text: bar.text || "",
    bar_bg_color: bar.bg_color || BAR_DEFAULTS.bar_bg_color,
    bar_text_color: bar.text_color || BAR_DEFAULTS.bar_text_color,
  };
}

export function validateBarForm(form) {
  const errors = {};
  if (form.bar_enabled && form.bar_text.trim().length > BAR_TEXT_MAX) {
    errors.bar_text = `Keep it under ${BAR_TEXT_MAX} characters`;
  }
  return errors;
}

/**
 * Form + saved coupon input → the `bar` object api/coupon-bar.js expects,
 * or null when the bar is off. An empty text falls back to the default.
 */
export function formToBarInput(form, input, currency) {
  if (!form.bar_enabled) return null;
  return {
    code: input.code,
    text: form.bar_text.trim() || defaultBarText(input, currency),
    bg_color: form.bar_bg_color,
    text_color: form.bar_text_color,
    ends_at: input.expiry_date,
  };
}
