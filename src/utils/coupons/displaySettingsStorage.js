/**
 * Storage and helpers for coupon storefront display options:
 * - Top Announcement Bar (الشريط الإعلاني أعلى المتجر - مثل الصورة 2)
 * - Page Card Banner (بانر الكوبون في صفحة المنتج، قائمة المنتجات، والسلة - مثل الصورة 1)
 */

const STORAGE_PREFIX = "salla_coupon_display_v1_";

export const DEFAULT_DISPLAY_SETTINGS = {
  // Top Announcement Bar (الصورة 2)
  show_announcement_bar: false,
  announcement_text: "",
  announcement_bg_color: "#f59e0b", // Amber/yellow like Image 2
  announcement_text_color: "#1c1917",

  // In-page Card Placements (الصورة 1)
  display_product_page: true,
  display_category_page: false,
  display_cart_page: true,

  // In-page Card Content & Styling
  card_badge_title: "كوبون لك",
  card_headline_text: "",
  card_bg_color: "#092d27", // Dark teal green like Image 1
  card_text_color: "#67e8f9", // Light cyan
};

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

/**
 * Builds smart default headline and announcement text based on coupon type and amount
 */
export function generateSmartCouponTexts(coupon) {
  const code = normalizeCode(coupon?.code || "COUPON");
  const amount = Number(coupon?.amount) || 10;
  const isPercentage = !String(coupon?.type || "").toLowerCase().startsWith("f");

  const discountText = isPercentage ? `خصم ${amount}%` : `خصم ${amount} ر.س`;
  const headline = `${discountText} على أول طلب`;
  const announcement = `عروض حصرية بدأت · كود الخصم: ${code} (${discountText})`;

  return { headline, announcement };
}

/**
 * Retrieves display settings for a coupon from localStorage
 */
export function getCouponDisplaySettings(code, fallbackCoupon = null) {
  const normalized = normalizeCode(code);
  const smart = generateSmartCouponTexts(fallbackCoupon || { code: normalized });

  const defaults = {
    ...DEFAULT_DISPLAY_SETTINGS,
    card_headline_text: smart.headline,
    announcement_text: smart.announcement,
  };

  if (!normalized || typeof window === "undefined" || !window.localStorage) {
    return defaults;
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${normalized}`);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      card_headline_text: parsed.card_headline_text || smart.headline,
      announcement_text: parsed.announcement_text || smart.announcement,
    };
  } catch {
    return defaults;
  }
}

/**
 * Saves display settings for a coupon to localStorage
 */
export function saveCouponDisplaySettings(code, settings) {
  const normalized = normalizeCode(code);
  if (!normalized || typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${normalized}`,
      JSON.stringify({
        show_announcement_bar: Boolean(settings.show_announcement_bar),
        announcement_text: settings.announcement_text || "",
        announcement_bg_color: settings.announcement_bg_color || "#f59e0b",
        announcement_text_color: settings.announcement_text_color || "#1c1917",
        display_product_page: Boolean(settings.display_product_page),
        display_category_page: Boolean(settings.display_category_page),
        display_cart_page: Boolean(settings.display_cart_page),
        card_badge_title: settings.card_badge_title || "كوبون لك",
        card_headline_text: settings.card_headline_text || "",
        card_bg_color: settings.card_bg_color || "#092d27",
        card_text_color: settings.card_text_color || "#67e8f9",
        updatedAt: new Date().toISOString(),
      }),
    );
    return true;
  } catch (err) {
    console.warn("Failed to save coupon display settings:", err);
    return false;
  }
}

/**
 * Removes display settings when coupon is deleted
 */
export function removeCouponDisplaySettings(code) {
  const normalized = normalizeCode(code);
  if (!normalized || typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${normalized}`);
  } catch {
    // Ignore storage errors
  }
}
