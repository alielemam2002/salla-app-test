/**
 * Meta Embedded Signup (WhatsApp) for a Tech Provider: the merchant clicks
 * "connect", logs in with Facebook in Meta's popup, picks/creates their
 * business portfolio, WhatsApp Business Account and number, and the page
 * gets back the WABA ID, the phone number ID and a code. Then the server:
 * 1. exchanges the code (valid ~30 s) for the merchant's business token
 *    GET /oauth/access_token?client_id&client_secret&code
 * 2. subscribes this app to the merchant's WABA webhooks
 *    POST /{waba-id}/subscribed_apps
 * 3. registers the number for Cloud API with a 6-digit PIN
 *    POST /{phone-number-id}/register
 * docs: https://developers.facebook.com/docs/whatsapp/embedded-signup
 *
 * Env: META_APP_ID, META_APP_SECRET (server only), META_ES_CONFIG_ID
 * (the Facebook Login for Business configuration). App ID and config ID
 * are public: the browser needs them to open the popup.
 */

import { randomInt } from "node:crypto";
import { graphRequest, metaFailure } from "./whatsappGraph.js";

const env = (name) => String(process.env[name] || "").trim();

/** What the browser needs to open the popup, or null if not set up. */
export function signupConfig() {
  const appId = env("META_APP_ID");
  const configId = env("META_ES_CONFIG_ID");
  if (!appId || !configId || !env("META_APP_SECRET")) return null;
  return { appId, configId };
}

/** A new 6-digit two-step verification PIN for the number. */
export const newPin = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/**
 * The code from FB.login → the merchant's business token.
 * Resolves to { ok, token } or { ok: false, error, detail }.
 */
export async function exchangeSignupCode(code, version) {
  const params = new URLSearchParams({
    client_id: env("META_APP_ID"),
    client_secret: env("META_APP_SECRET"),
    code: String(code),
  });
  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(version)}/oauth/access_token?${params}`,
  );
  let json = {};
  try {
    json = await response.json();
  } catch {
    // handled below
  }
  if (response.ok && json.access_token) {
    return { ok: true, token: json.access_token };
  }
  // Never echo the request URL: it carries the app secret.
  return {
    ok: false,
    error:
      "لم تقبل Meta رمز الربط (تنتهي صلاحيته بعد 30 ثانية). أعد المحاولة من زر الربط.",
    detail: json.error?.message || null,
  };
}

/** Get this app's webhooks for the merchant's WABA. */
export async function subscribeApp(config, wabaId) {
  const result = await graphRequest(
    config,
    `${encodeURIComponent(wabaId)}/subscribed_apps`,
    { method: "POST" },
  );
  return result.ok ? { ok: true } : { ok: false, ...metaFailure(result) };
}

/** Register the number for Cloud API (sets its two-step PIN). */
export async function registerPhone(config, phoneNumberId, pin) {
  const result = await graphRequest(
    config,
    `${encodeURIComponent(phoneNumberId)}/register`,
    { method: "POST", body: { messaging_product: "whatsapp", pin } },
  );
  return result.ok ? { ok: true } : { ok: false, ...metaFailure(result) };
}
