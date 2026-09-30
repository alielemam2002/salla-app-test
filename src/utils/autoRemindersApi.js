import { AUTO_REMINDERS_FUNCTION_URL, getAppId } from "./constants.js";

/**
 * Calls api/auto-reminders.js. Never throws: failures resolve to
 * `{ success: false, status, code, error, fields?, blockers? }`.
 */
async function callAutoRemindersApi(payload) {
  try {
    const response = await fetch(AUTO_REMINDERS_FUNCTION_URL, {
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

/** Settings, what's missing, today's count and the server's sent log. */
export function fetchAutoReminders(token) {
  return callAutoRemindersApi({ action: "get", token });
}

/** `settings` = { enabled, abandonedAfter, …, couponCode, consent? } */
export function saveAutoReminders(token, settings) {
  return callAutoRemindersApi({ action: "save", token, settings });
}

/** Run once now for this store, with the same rules as the daily run. */
export function runAutoRemindersNow(token) {
  return callAutoRemindersApi({ action: "run_now", token });
}
