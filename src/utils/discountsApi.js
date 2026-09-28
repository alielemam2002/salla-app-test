import { PRODUCTS_FUNCTION_URL, getAppId } from "./constants.js";

/**
 * Common fetch helper for calling the Vercel serverless function.
 */
async function callApi(payload) {
  try {
    const response = await fetch(PRODUCTS_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return {
        success: false,
        code: "bad_response",
        error: `Server returned non-JSON (status ${response.status})`,
      };
    }
  } catch (error) {
    return { success: false, code: "network_error", error: error.message };
  }
}

/**
 * Extract the true regular (base) price of a product.
 * In Salla, when a product is on sale, `product.price` reflects the discounted price,
 * while `product.regular_price` holds the original base price.
 * @param {object} product
 * @returns {number}
 */
export function getProductRegularPrice(product) {
  if (!product) return 0;
  const regRaw = product.regular_price;
  const regVal = typeof regRaw === "object" ? regRaw?.amount : regRaw;
  if (
    regVal !== undefined &&
    regVal !== null &&
    regVal !== "" &&
    !isNaN(Number(regVal)) &&
    Number(regVal) > 0
  ) {
    return Number(regVal);
  }

  const priceRaw = product.price;
  const priceVal = typeof priceRaw === "object" ? priceRaw?.amount : priceRaw;
  if (
    priceVal !== undefined &&
    priceVal !== null &&
    priceVal !== "" &&
    !isNaN(Number(priceVal))
  ) {
    return Number(priceVal);
  }

  return 0;
}

/**
 * Calculate the new sale price based on regular price, discount type, and value.
 * @param {number} regularPrice
 * @param {"percentage"|"fixed"} discountType
 * @param {number} discountValue
 * @returns {number}
 */
export function calculateDiscountedPrice(
  regularPrice,
  discountType,
  discountValue,
) {
  const price = Number(regularPrice);
  const val = Number(discountValue);

  if (isNaN(price) || price <= 0 || isNaN(val) || val <= 0) {
    return price;
  }

  let newPrice = price;
  if (discountType === "percentage") {
    const discountAmount = (price * val) / 100;
    newPrice = price - discountAmount;
  } else if (discountType === "fixed") {
    newPrice = price - val;
  }

  // Round to 2 decimal places and ensure not negative
  return Math.max(0, Math.round(newPrice * 100) / 100);
}

/**
 * Prepare payload for Salla bulkPrice endpoint to apply discounts.
 * @param {Array<object>} products
 * @param {object} config
 * @param {"percentage"|"fixed"} config.discountType
 * @param {number} config.discountValue
 * @param {string} [config.saleEnd]
 * @returns {Array<{ id: number, price: number, sale_price: number, sale_end?: string|null }>}
 */
export function prepareBulkDiscountPayload(
  products,
  { discountType, discountValue, saleEnd },
) {
  return products
    .map((product) => {
      const regularPrice = getProductRegularPrice(product);

      if (isNaN(regularPrice) || regularPrice <= 0) {
        return null;
      }

      const discountedPrice = calculateDiscountedPrice(
        regularPrice,
        discountType,
        discountValue,
      );

      const entry = {
        id: Number(product.id),
        price: regularPrice,
        sale_price: discountedPrice,
      };

      if (saleEnd) {
        entry.sale_end = saleEnd;
      }

      return entry;
    })
    .filter(Boolean);
}

/**
 * Prepare payload for Salla bulkPrice endpoint to remove discounts (reset sale_price).
 * @param {Array<object>} products
 * @returns {Array<{ id: number, price: number, sale_price: null, sale_end: null }>}
 */
export function prepareRemoveDiscountPayload(products) {
  return products
    .map((product) => {
      const regularPrice = getProductRegularPrice(product);

      if (isNaN(regularPrice) || regularPrice <= 0) {
        return null;
      }

      return {
        id: Number(product.id),
        price: regularPrice,
        sale_price: null,
        sale_end: null,
      };
    })
    .filter(Boolean);
}

/**
 * Send bulk price update to Salla via the serverless function.
 * @param {string} token - Embedded session token
 * @param {Array<object>} products - Array of product price items
 * @returns {Promise<{ success: boolean, count?: number, message?: string, error?: string }>}
 */
export async function bulkUpdateProductPrices(token, products) {
  return callApi({
    action: "bulk_price",
    token,
    appId: getAppId(),
    products,
  });
}

// =============================================================================
// Extensible Architecture for Future Storewide Coupons
// (To be implemented when Coupon Feature is activated)
// =============================================================================
/*
export async function createStorewideCoupon(token, couponData) {
  // POST /admin/v2/coupons
}

export async function listStorewideCoupons(token, options) {
  // GET /admin/v2/coupons
}

export async function deleteStorewideCoupon(token, couponId) {
  // DELETE /admin/v2/coupons/{id}
}
*/
