/**
 * Salla helpers shared by the serverless functions:
 * - embedded token introspection (who is the merchant?)
 * - Merchant API calls for one store with THAT store's OAuth token
 *
 * Easy Mode: there is no access token in env. Salla sends each store's
 * tokens in the app.store.authorize webhook (install / app update); they are
 * stored encrypted and refreshed by api/_lib/merchantTokens.js. A store
 * whose tokens never arrived gets 403 store_not_authorized ("reinstall").
 */

import { getAccessToken } from "./merchantTokens.js";

const INTROSPECT_URL = "https://api.salla.dev/exchange-authority/v1/introspect";
const MERCHANT_API_BASE = "https://api.salla.dev/admin/v2";

function parseJson(text, status, label) {
  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: { message: `ردّ غير متوقع من ${label} (الحالة ${status})` },
    };
  }
}

// ============================================
// Embedded token → merchant identity
// ============================================

/**
 * Verify the short-lived embedded token with Salla.
 * @returns {Promise<{ ok: true, data: { merchant_id, user_id, exp } } | { ok: false, status, error }>}
 */
export async function introspectEmbeddedToken(token, appId) {
  const response = await fetch(INTROSPECT_URL, {
    method: "POST",
    headers: { "S-Source": String(appId), "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  const body = parseJson(await response.text(), response.status, "Introspect");
  if (!response.ok || !body.success || !body.data?.merchant_id) {
    return {
      ok: false,
      status: 401,
      // Salla's own reason is English and technical; the merchant only needs
      // to reopen the app.
      error: "انتهت جلسة سلة أو أنها غير صالحة. أعد فتح التطبيق من لوحة سلة.",
    };
  }
  return { ok: true, data: body.data };
}

// ============================================
// Merchant API
// ============================================

/**
 * The Merchant API for one store: `(path, options) => { status, body }`.
 * `merchantId` must come from a verified source (introspect, or a signed
 * webhook), never from the request. The token is read (and refreshed if
 * needed) on the first call.
 */
export function sallaApiFor(merchantId) {
  let accessToken = null;
  return async (path, options = {}) => {
    accessToken = accessToken || (await getAccessToken(String(merchantId)));
    return request(accessToken, path, options);
  };
}

/**
 * One Merchant API request.
 * @param {string} accessToken - the store's OAuth access token
 * @param {string} path - API endpoint path (e.g. '/products')
 * @param {object} [options] - fetch options (method, body, headers)
 * @returns {Promise<{ status: number, body: any }>}
 */
async function request(accessToken, path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const hasBody = options.body !== undefined && options.body !== null;
  // FormData goes out as multipart/form-data; fetch sets the boundary header.
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const body = hasBody
    ? typeof options.body === "string" || isFormData
      ? options.body
      : JSON.stringify(options.body)
    : undefined;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    ...(hasBody && !isFormData ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  const response = await fetch(`${MERCHANT_API_BASE}${path}`, {
    method,
    headers,
    ...(body ? { body } : {}),
  });

  const responseBody = parseJson(
    await response.text(),
    response.status,
    "Merchant API",
  );

  if (response.status === 401 || response.status === 403) {
    // Surface Salla's own reason (revoked token, missing scope, inactive user…)
    const reason = responseBody.error?.message || "بدون سبب";
    const scope = /scope/i.test(reason);
    // Never put any part of the token in a message: it reaches the browser.
    const error = new Error(
      scope
        ? `ينقص التطبيق صلاحية على متجرك: ${reason}`
        : `رفضت سلة صلاحية التطبيق على متجرك (${reason}). أعد تثبيت التطبيق من لوحة تحكم سلة.`,
    );
    error.code = scope ? "missing_scope" : "token_expired";
    error.status = response.status;
    error.details = responseBody;
    throw error;
  }

  return { status: response.status, body: responseBody };
}

const USER_INFO_URL = "https://accounts.salla.sa/oauth2/user/info";

/**
 * The user and merchant behind a store's token (accounts.salla.sa). Resolves
 * to { ok, data } or { ok: false, status, error }; never returns the token.
 */
export async function sallaUserInfo(merchantId) {
  const token = await getAccessToken(String(merchantId));
  const response = await fetch(USER_INFO_URL, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const body = parseJson(await response.text(), response.status, "User Info");
  if (!response.ok || body.success === false) {
    return {
      ok: false,
      status: response.status,
      error:
        body.error?.message ||
        `تعذّر قراءة بيانات الحساب (الحالة ${response.status})`,
    };
  }
  // Documented with a `data` envelope; accept the bare shape too.
  return { ok: true, data: body.data ?? body };
}
