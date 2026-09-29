/**
 * Turn a failed coupons API result into text a merchant can act on.
 * Never exposes stack traces or the raw token diagnostics from the server.
 */

const ACTION_TITLES = {
  load: "Could not load coupons.",
  create: "Could not create coupon.",
  update: "Could not update coupon.",
  delete: "Could not delete coupon.",
  bar: "Could not update the storefront announcement bar.",
  barLoad: "Could not load the storefront announcement bar.",
};

const isBarAction = (action) => action === "bar" || action === "barLoad";

export const FIELD_LABELS = {
  code: "Coupon code",
  type: "Discount type",
  amount: "Discount",
  maximum_amount: "Maximum discount",
  minimum_amount: "Minimum order",
  start_date: "Start date",
  expiry_date: "End date",
  usage_limit: "Usage limit",
  usage_limit_per_user: "Limit per customer",
  free_shipping: "Free shipping",
  exclude_sale_products: "Exclude sale products",
  group_suffix: "Group suffix",
};

// Salla sometimes returns translation keys instead of sentences.
const isTranslationKey = (msg) => /^[a-z_]+(\.[a-z_]+)+$/i.test(msg || "");

function reasonFor(result, action) {
  const { status, code } = result;
  if (code === "settings_not_saved" && result.error) return result.error;
  if (isBarAction(action) && (code === "missing_scope" || status === 403)) {
    return "The app can't read or write its own settings in this store. Check that the app is installed and active.";
  }
  if (isBarAction(action) && status === 404) {
    return "Salla didn't find this app's settings. Check SALLA_APP_ID and that the app is installed on the store.";
  }
  if (code === "network_error" || status === 0) {
    return "Network problem. Check your connection and try again.";
  }
  if (code === "session_invalid") {
    return "Your Salla session has expired. Refresh the session and try again.";
  }
  if (code === "token_not_configured") {
    return "The store's API access token (SALLA_ACCESS_TOKEN) is not configured on the server.";
  }
  if (code === "missing_scope") {
    return "The app doesn't have permission to manage coupons. It needs the marketing.read_write scope.";
  }
  if (code === "token_expired") {
    return "The store's API access token is invalid or expired. Replace SALLA_ACCESS_TOKEN.";
  }
  switch (status) {
    case 400:
      return "The request was invalid.";
    case 401:
      return "Salla didn't accept the app's credentials.";
    case 403:
      return "The app isn't allowed to do this.";
    case 404:
      return "This coupon no longer exists. It may have been deleted.";
    case 409:
      return "A coupon with this code already exists.";
    case 422:
      return "Some fields are invalid.";
    case 429:
      return "Too many requests to Salla. Wait a minute and try again.";
    default:
      if (status >= 500)
        return "Salla had a temporary problem. Try again later.";
      return null;
  }
}

/**
 * @param {object} result - `{ status, code, error, fields }` from couponsApi
 * @param {"load"|"create"|"update"|"delete"|"bar"|"barLoad"} action
 * @returns {{ title: string, reason: string, fieldErrors: Record<string,string>, canRefreshSession: boolean }}
 */
export function describeCouponError(result = {}, action = "load") {
  const fieldErrors = {};
  if (result.fields && typeof result.fields === "object") {
    for (const [key, messages] of Object.entries(result.fields)) {
      const text = Array.isArray(messages)
        ? messages.join(" ")
        : String(messages);
      if (text) fieldErrors[key] = text;
    }
  }

  const known = reasonFor(result, action);
  const sallaMessage =
    result.code === "salla_api_error" && !isTranslationKey(result.error)
      ? result.error
      : null;
  // For 4xx from Salla, its own message is usually the most specific reason.
  const reason =
    (result.status >= 400 && result.status < 500 && sallaMessage) ||
    known ||
    sallaMessage ||
    "Something went wrong. Try again.";

  return {
    title: ACTION_TITLES[action] || ACTION_TITLES.load,
    reason,
    fieldErrors,
    canRefreshSession: result.code === "session_invalid",
  };
}
