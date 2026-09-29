import { WHATSAPP_FUNCTION_URL, getAppId } from "./constants.js";

/**
 * Calls api/whatsapp.js. Never throws: failures resolve to
 * `{ success: false, status, code, error, metaCode?, detail? }`.
 */
async function callWhatsAppApi(payload) {
  try {
    const response = await fetch(WHATSAPP_FUNCTION_URL, {
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
      error: "Network problem. Check your connection and try again.",
    };
  }
}

/** Is the WhatsApp Cloud API set up on the server, and with which template? */
export function fetchWhatsAppStatus(token) {
  return callWhatsAppApi({ action: "status", token });
}

/** Send the reminder template for one cart (the server reads the cart). */
export function sendCartWhatsApp(token, cartId, couponCode) {
  return callWhatsAppApi({ action: "send", token, cartId, couponCode });
}
