import { STOCK_ALERTS_FUNCTION_URL, getAppId } from "./constants.js";

/**
 * Calls api/stock-alerts.js. Never throws: failures resolve to
 * `{ success: false, status, code, error }`.
 */
async function callAlertsApi(payload) {
  try {
    const response = await fetch(STOCK_ALERTS_FUNCTION_URL, {
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
  } catch {
    return {
      success: false,
      status: 0,
      code: "network_error",
      error: "تعذّر الاتصال بالإنترنت. تحقق من اتصالك ثم حاول مرة أخرى.",
    };
  }
}

/** Threshold, recent order alerts (with `unread`), setup state. */
export function fetchAlertsOverview(token) {
  return callAlertsApi({ action: "overview", token });
}

/** Products out of stock or at/under the threshold: { out, low, … }. */
export function fetchStockLevels(token) {
  return callAlertsApi({ action: "stock", token });
}

export function saveAlertThreshold(token, threshold) {
  return callAlertsApi({ action: "settings_save", token, threshold });
}

export function markAlertsRead(token) {
  return callAlertsApi({ action: "mark_read", token });
}

export function clearStockAlerts(token) {
  return callAlertsApi({ action: "clear", token });
}
