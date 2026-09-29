import { COUPON_BAR_FUNCTION_URL, getAppId } from "./constants.js";

/**
 * POST to the coupon-bar function. Never throws: failures resolve to
 * `{ success: false, status, code, error, fields? }`.
 */
async function callCouponBarApi(payload) {
  try {
    const response = await fetch(COUPON_BAR_FUNCTION_URL, {
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
        error: `Server returned non-JSON (status ${response.status})`,
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

/** The bar currently shown on the storefront, or `bar: null`. */
export function fetchCouponBar(token) {
  return callCouponBarApi({ action: "get", token });
}

/** Show `bar` on the storefront. Replaces any other coupon's bar. */
export function saveCouponBar(token, bar) {
  return callCouponBarApi({ action: "set", token, bar });
}

/** Hide the bar, but only if it still belongs to coupon `code`. */
export function clearCouponBar(token, code) {
  return callCouponBarApi({ action: "clear", token, code });
}
