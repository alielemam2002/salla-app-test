// Token verification is handled by a Vercel serverless function (api/verify-token.js)
export const VERIFY_FUNCTION_URL = "/api/verify-token";

// Lists store products using the merchant's stored OAuth token (api/products.js)
export const PRODUCTS_FUNCTION_URL = "/api/products";

// Uploads one product image file as multipart/form-data (api/product-media.js)
export const PRODUCT_MEDIA_FUNCTION_URL = "/api/product-media";

// Storewide coupons CRUD (api/coupons.js)
export const COUPONS_FUNCTION_URL = "/api/coupons";

// Abandoned carts, read-only (api/carts.js)
export const CARTS_FUNCTION_URL = "/api/carts";

// Cart reminders through the WhatsApp Cloud API (api/whatsapp.js)
export const WHATSAPP_FUNCTION_URL = "/api/whatsapp";

// Stock alerts for the merchant: order alerts + stock scan (api/stock-alerts.js)
export const STOCK_ALERTS_FUNCTION_URL = "/api/stock-alerts";

// Smart replenishment reminders (api/replenish.js)
export const REPLENISH_FUNCTION_URL = "/api/replenish";

// Store customers + groups for WhatsApp campaigns (api/customers.js)
export const CUSTOMERS_FUNCTION_URL = "/api/customers";

// App ID - can be overridden via URL parameter ?appId=XXX
export function getAppId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("app_id");
}
