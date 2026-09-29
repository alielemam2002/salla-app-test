import { formatMoney, itemCount, money } from "./cartModel.js";

/**
 * WhatsApp recovery message, sent by the merchant from their own WhatsApp
 * through a wa.me link (no WhatsApp API, no stored credentials).
 *
 * Only variables we can fill from Salla's cart data are offered. There is
 * no store name in the cart response, so there is no {{store_name}}.
 */
export const TEMPLATE_VARIABLES = [
  { key: "customer_name", label: "Customer name" },
  { key: "cart_total", label: "Cart total" },
  { key: "cart_items", label: "Number of items" },
  { key: "checkout_url", label: "Salla checkout link" },
  { key: "coupon_code", label: "Coupon code (if chosen)" },
];

export const MESSAGE_LOCALES = [
  { value: "ar", label: "العربية", dir: "rtl" },
  { value: "en", label: "English", dir: "ltr" },
];

export const DEFAULT_TEMPLATES = {
  ar: [
    "مرحبًا {{customer_name}} 👋",
    "",
    "تركت {{cart_items}} منتجات في سلتك بقيمة {{cart_total}}.",
    "استخدم كود {{coupon_code}} للحصول على خصم إضافي.",
    "",
    "أكمل طلبك من هنا:",
    "{{checkout_url}}",
  ].join("\n"),
  en: [
    "Hi {{customer_name}} 👋",
    "",
    "You left {{cart_items}} items in your cart ({{cart_total}}).",
    "Use code {{coupon_code}} for an extra discount.",
    "",
    "Complete your order here:",
    "{{checkout_url}}",
  ].join("\n"),
};

const FALLBACK_NAME = { ar: "عميلنا العزيز", en: "there" };

const VAR_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;
const KNOWN = new Set(TEMPLATE_VARIABLES.map((v) => v.key));

/** Variables used in a template that we can't fill. */
export function unknownVariables(template) {
  const unknown = new Set();
  for (const match of String(template || "").matchAll(VAR_RE)) {
    if (!KNOWN.has(match[1])) unknown.add(match[1]);
  }
  return [...unknown];
}

/**
 * Fill a template. A line whose variable has no value is dropped entirely
 * (e.g. the coupon line when no coupon is chosen), so the customer never
 * sees an empty "Use code ." sentence.
 */
export function renderTemplate(template, values) {
  return String(template || "")
    .split("\n")
    .filter((line) => {
      for (const match of line.matchAll(VAR_RE)) {
        if (KNOWN.has(match[1]) && !values[match[1]]) return false;
      }
      return true;
    })
    .map((line) =>
      line.replace(VAR_RE, (whole, key) =>
        KNOWN.has(key) ? String(values[key]) : whole,
      ),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Variable values for one cart, from Salla's data only. */
export function cartMessageValues(
  cart,
  { locale = "ar", couponCode = "" } = {},
) {
  const firstName = String(cart?.customer?.name || "")
    .trim()
    .split(/\s+/)[0];
  return {
    customer_name: firstName || FALLBACK_NAME[locale] || FALLBACK_NAME.en,
    cart_total: cart?.total ? formatMoney(money(cart.total)) : "",
    cart_items: String(itemCount(cart) || ""),
    checkout_url: cart?.checkout_url || "",
    coupon_code: couponCode || "",
  };
}

/**
 * wa.me needs the full international number, digits only. Salla sends
 * mobiles like "+966560000000". A local number without a country code
 * (e.g. "0560000000") can't be turned into a wa.me number safely.
 */
export function whatsappNumber(mobile) {
  let digits = String(mobile || "").trim();
  const international = digits.startsWith("+") || digits.startsWith("00");
  digits = digits.replace(/\D/g, "").replace(/^00/, "");
  if (!international && digits.startsWith("0")) return null;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function whatsappUrl(number, text) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Sample cart for the template preview (clearly labelled in the UI). */
export const SAMPLE_CART = {
  customer: { name: "Ahmed Ali", mobile: "+966500000000" },
  total: { amount: 420, currency: "SAR" },
  items: [{ quantity: 2 }, { quantity: 1 }],
  checkout_url: "https://salla.sa/your-store/checkout/123456",
};
