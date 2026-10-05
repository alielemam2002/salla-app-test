/**
 * Meta Embedded Signup in the browser ("connect WhatsApp with Facebook").
 * docs: https://developers.facebook.com/docs/whatsapp/embedded-signup
 *
 * 1. Load Meta's JS SDK and FB.init with the app ID (from the server).
 * 2. FB.login with the Facebook Login for Business configuration opens
 *    Meta's popup, where the merchant picks their business, WhatsApp
 *    Business Account and number.
 * 3. The popup posts the WABA ID + phone number ID to this window
 *    (type "WA_EMBEDDED_SIGNUP"), and FB.login's callback gets a code.
 * 4. The server exchanges the code (api/whatsapp.js signup_complete).
 */

const SDK_URL = "https://connect.facebook.net/en_US/sdk.js";

let loading = null;

/** Load Meta's SDK once and init it. Resolves to window.FB. */
export function loadFacebookSdk({ appId, version }) {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const init = () => {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve(window.FB);
    };
    if (window.FB) {
      init();
      return;
    }
    window.fbAsyncInit = init;
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => {
      loading = null;
      reject(new Error("sdk_load_failed"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Tests only: forget the loaded SDK. */
export function resetFacebookSdk() {
  loading = null;
}

/** FB.login options for Embedded Signup (v4, as in Meta's docs). */
export const loginOptions = (configId) => ({
  config_id: configId,
  response_type: "code",
  override_default_response_type: true,
  extras: { setup: {} },
});

const fromFacebook = (origin) => {
  try {
    const host = new URL(origin).hostname;
    return host === "facebook.com" || host.endsWith(".facebook.com");
  } catch {
    return false;
  }
};

/**
 * A message from Meta's popup → one of
 * { kind: "finish", wabaId, phoneNumberId }
 * { kind: "no_phone", wabaId }          (an account without a number)
 * { kind: "cancel", step }              (closed at that step)
 * { kind: "error", message }
 * or null for anything else (other origins, other messages).
 */
export function parseSignupMessage(event) {
  if (!fromFacebook(event?.origin)) return null;
  let data = event.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (data?.type !== "WA_EMBEDDED_SIGNUP") return null;
  const info = data.data || {};
  const name = String(data.event || "");
  if (name.startsWith("FINISH")) {
    const wabaId = String(info.waba_id || "");
    const phoneNumberId = String(info.phone_number_id || "");
    if (!wabaId) return { kind: "error", message: null };
    return phoneNumberId
      ? { kind: "finish", wabaId, phoneNumberId }
      : { kind: "no_phone", wabaId };
  }
  if (name === "CANCEL") {
    return info.error_message
      ? { kind: "error", message: String(info.error_message) }
      : { kind: "cancel", step: info.current_step || null };
  }
  if (name === "ERROR") {
    return { kind: "error", message: info.error_message || null };
  }
  return null;
}
