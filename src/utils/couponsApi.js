import { COUPONS_FUNCTION_URL, getAppId } from "./constants.js";

// Safety cap for "load every page" (Salla returns 15 coupons per page).
const MAX_PAGES = 20;

/**
 * POST to the coupons function. Never throws: failures resolve to
 * `{ success: false, status, code, error, fields? }`.
 */
async function callCouponsApi(payload) {
  try {
    const response = await fetch(COUPONS_FUNCTION_URL, {
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
        error: `استجابة غير صالحة من الخادم (الحالة ${response.status})`,
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

export function fetchCouponsPage(token, { page = 1, keyword } = {}) {
  return callCouponsApi({ action: "list", token, page, keyword });
}

/**
 * Fetch every page one after another. Sequential on purpose: Salla rate
 * limits per store, so there is never more than one request in flight.
 */
export async function fetchAllCoupons(token, { keyword } = {}) {
  const coupons = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await fetchCouponsPage(token, { page, keyword });
    if (!result.success) return result;
    coupons.push(...(result.coupons || []));
    totalPages = Math.min(result.pagination?.totalPages || page, MAX_PAGES);
    page += 1;
  } while (page <= totalPages);
  return { success: true, coupons };
}

export function createCoupon(token, coupon) {
  return callCouponsApi({ action: "create", token, coupon });
}

export function updateCoupon(token, couponId, coupon) {
  return callCouponsApi({ action: "update", token, couponId, coupon });
}

export function deleteCoupon(token, couponId) {
  return callCouponsApi({ action: "delete", token, couponId });
}
