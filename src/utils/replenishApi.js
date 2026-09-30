import { REPLENISH_FUNCTION_URL, getAppId } from "./constants.js";

/**
 * Calls api/replenish.js. Never throws: failures resolve to
 * `{ success: false, status, code, error, fields?, blockers? }`.
 */
async function callReplenishApi(payload) {
  try {
    const response = await fetch(REPLENISH_FUNCTION_URL, {
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

/** Settings, cycles, reminders, today's count and what's missing. */
export function fetchReplenish(token) {
  return callReplenishApi({ action: "get", token });
}

/** `settings` = { enabled, template, language, params, leadDays, … } */
export function saveReplenishSettings(token, settings) {
  return callReplenishApi({ action: "settings_save", token, settings });
}

/** days = null removes the product's cycle. */
export function setProductCycle(token, { productId, days, name }) {
  return callReplenishApi({
    action: "cycle_set",
    token,
    productId,
    days,
    name,
  });
}

export function sendReminderNow(token, reminderId) {
  return callReplenishApi({ action: "send_now", token, reminderId });
}

export function cancelReplenishReminder(token, reminderId) {
  return callReplenishApi({ action: "cancel", token, reminderId });
}

export function sendReplenishTest(token, to) {
  return callReplenishApi({ action: "send_test", token, to });
}
