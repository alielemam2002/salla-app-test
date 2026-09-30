import { STORE_FUNCTION_URL, getAppId } from "./constants.js";

/**
 * The merchant's store details (api/store.js): { access, store, user,
 * errors }. Never throws: failures resolve to `{ success: false, … }`.
 */
export async function fetchStoreInfo(token) {
  try {
    const response = await fetch(STORE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "info", token, appId: getAppId() }),
    });
    const json = await response.json().catch(() => ({}));
    return json.success
      ? json
      : {
          success: false,
          status: response.status,
          error: "تعذّر تحميل بيانات المتجر",
          ...json,
        };
  } catch {
    return {
      success: false,
      status: 0,
      code: "network_error",
      error: "تعذّر الاتصال بالإنترنت. تحقق من اتصالك ثم حاول مرة أخرى.",
    };
  }
}
