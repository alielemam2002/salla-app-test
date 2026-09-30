/**
 * Salla helpers shared by the serverless functions:
 * - embedded token introspection (who is the merchant?)
 * - authenticated Merchant API calls using the store's access token
 *
 * There is no token storage: the Merchant API access token comes from the
 * SALLA_ACCESS_TOKEN env var (one store). It expires after 14 days and must
 * then be replaced by hand.
 */

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
 * Call the Merchant API with the access token from SALLA_ACCESS_TOKEN.
 * @param {string} path - API endpoint path (e.g. '/products')
 * @param {object} [options] - fetch options (method, body, headers)
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function merchantApi(path, options = {}) {
  // Tolerate common copy/paste mistakes: whitespace, quotes, "Bearer " prefix
  const accessToken = (process.env.SALLA_ACCESS_TOKEN || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    const error = new Error(
      "لم يتم إعداد رمز الوصول لواجهة سلة (SALLA_ACCESS_TOKEN) على الخادم.",
    );
    error.code = "token_not_configured";
    throw error;
  }

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
    // Surface Salla's own reason (invalid token, missing scope, inactive user…)
    const reason = responseBody.error?.message || "بدون سبب";
    // Never put any part of the token in a message: it reaches the browser.
    const error = new Error(
      `رفضت سلة رمز الوصول (SALLA_ACCESS_TOKEN): ${reason}`,
    );
    error.code = /scope/i.test(reason) ? "missing_scope" : "token_expired";
    error.status = response.status;
    error.details = responseBody;
    throw error;
  }

  return { status: response.status, body: responseBody };
}

/**
 * Id of the store SALLA_ACCESS_TOKEN belongs to (GET /store/info, scope
 * offline_access). Code that runs for a store without a merchant session
 * (webhooks) uses it to read only that store's data with this token.
 * @returns {Promise<{ ok: true, id: string } | { ok: false, error: string }>}
 */
export async function tokenStoreId() {
  try {
    const { status, body } = await merchantApi("/store/info");
    if (body?.success && body.data?.id) {
      return { ok: true, id: String(body.data.id) };
    }
    return {
      ok: false,
      error:
        body?.error?.message || `تعذّر قراءة بيانات المتجر (الحالة ${status})`,
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
