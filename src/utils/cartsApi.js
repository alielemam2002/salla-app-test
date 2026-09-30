import { CARTS_FUNCTION_URL, getAppId } from "./constants.js";

// Safety cap for "load every page": 20 × 60 = 1200 carts.
export const MAX_CART_PAGES = 20;

/**
 * POST to the carts function. Never throws: failures resolve to
 * `{ success: false, status, code, error }`.
 */
async function callCartsApi(payload) {
  try {
    const response = await fetch(CARTS_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, appId: getAppId() }),
    });
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return json.success ? json : { status: response.status, ...json };
    } catch {
      return {
        success: false,
        status: response.status,
        code: "bad_response",
        error: `ردّ الخادم بشكل غير متوقع (الحالة ${response.status})`,
      };
    }
  } catch (error) {
    return {
      success: false,
      status: 0,
      code: "network_error",
      error: error.message,
    };
  }
}

/**
 * Every abandoned cart, one page after another (Salla's pagination here is
 * cursor-style: keep going while `next` is set). Sequential so there is
 * never more than one request in flight against the store's rate limit.
 */
export async function fetchAllAbandonedCarts(token) {
  const carts = [];
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= MAX_CART_PAGES) {
    const result = await callCartsApi({ action: "list", token, page });
    if (!result.success) return result;
    carts.push(...(result.carts || []));
    hasMore = Boolean(result.pagination?.next);
    page += 1;
  }
  return { success: true, carts, truncated: hasMore };
}

/** One cart with its items, plus `products` (id → { name, thumbnail }). */
export function fetchAbandonedCart(token, cartId) {
  return callCartsApi({ action: "get", token, cartId });
}
