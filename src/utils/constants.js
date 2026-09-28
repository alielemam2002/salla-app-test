// Token verification is handled by a Vercel serverless function (api/verify-token.js)
export const VERIFY_FUNCTION_URL = "/api/verify-token";

// Lists store products using the merchant's stored OAuth token (api/products.js)
export const PRODUCTS_FUNCTION_URL = "/api/products";

// Storewide coupons CRUD (api/coupons.js)
export const COUPONS_FUNCTION_URL = "/api/coupons";

// Performance Center API (api/performance.js)
export const PERFORMANCE_FUNCTION_URL = "/api/performance";

// App ID - can be overridden via URL parameter ?appId=XXX
export function getAppId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("app_id");
}
