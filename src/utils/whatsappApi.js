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

/** The merchant's saved WhatsApp settings (token masked) + storage state. */
export function fetchWhatsAppSettings(token) {
  return callWhatsAppApi({ action: "settings_get", token });
}

/**
 * Save settings. The server checks them with Meta first. Leave
 * `settings.accessToken` empty to keep the saved token.
 */
export function saveWhatsAppSettings(token, settings) {
  return callWhatsAppApi({ action: "settings_save", token, settings });
}

export function deleteWhatsAppSettings(token) {
  return callWhatsAppApi({ action: "settings_delete", token });
}

/** Send the template with sample values to `to` (the merchant's number). */
export function sendWhatsAppTest(token, to) {
  return callWhatsAppApi({ action: "send_test", token, to });
}
