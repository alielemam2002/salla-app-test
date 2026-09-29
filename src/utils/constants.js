// Token verification is handled by a Vercel serverless function (api/verify-token.js)
export const VERIFY_FUNCTION_URL = "/api/verify-token";

// Lists store products using the merchant's stored OAuth token (api/products.js)
export const PRODUCTS_FUNCTION_URL = "/api/products";

// Storewide coupons CRUD (api/coupons.js)
export const COUPONS_FUNCTION_URL = "/api/coupons";

// Storefront coupon announcement bar, kept in the app's settings (api/coupon-bar.js)
export const COUPON_BAR_FUNCTION_URL = "/api/coupon-bar";

// App ID - can be overridden via URL parameter ?appId=XXX
export function getAppId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("app_id");
}
