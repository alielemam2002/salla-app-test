/**
 * Messages about the app's access to the merchant's store. The server uses
 * each store's own OAuth tokens (Easy Mode, api/_lib/merchantTokens.js);
 * they arrive when the app is installed or updated, so the fix is almost
 * always to reinstall/update the app. Shared by every feature's errors.
 */

const REINSTALL = "أعد تثبيت التطبيق من لوحة تحكم سلة ثم افتحه مرة أخرى.";

const MESSAGES = {
  store_not_authorized: `لم يستلم التطبيق صلاحية الوصول لمتجرك بعد. ${REINSTALL}`,
  token_expired: `رفضت سلة صلاحية التطبيق على متجرك. ${REINSTALL}`,
  token_refreshing: "يجري تجديد صلاحية الوصول لمتجرك. حاول مرة أخرى بعد لحظات.",
  token_refresh_failed:
    "تعذّر تجديد صلاحية الوصول لمتجرك الآن. حاول مرة أخرى بعد قليل.",
  oauth_not_configured:
    "إعداد التطبيق على الخادم غير مكتمل (SALLA_CLIENT_ID و SALLA_CLIENT_SECRET).",
};

/** Message for a store-access failure, or null for any other error. */
export function storeAccessMessage(code) {
  return MESSAGES[code] || null;
}

/** A missing OAuth scope: which permission, and how to grant it. */
export function missingScopeMessage(permission) {
  return `يحتاج التطبيق إلى صلاحية ${permission}. فعّلها من بوابة الشركاء، ثم حدّث التطبيق في متجرك.`;
}
