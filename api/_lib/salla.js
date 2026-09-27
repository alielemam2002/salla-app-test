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
      error: { message: `${label} returned non-JSON (status ${status})` },
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
      error: body.error?.message || "Invalid or expired session token",
    };
  }
  return { ok: true, data: body.data };
}

// ============================================
// Merchant API
// ============================================

/**
 * Call the Merchant API with the access token from SALLA_ACCESS_TOKEN.
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function merchantApi(path) {
  // Tolerate common copy/paste mistakes: whitespace, quotes, "Bearer " prefix
  const accessToken = (process.env.SALLA_ACCESS_TOKEN || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    const error = new Error(
      "SALLA_ACCESS_TOKEN is not set in Vercel environment variables",
    );
    error.code = "token_not_configured";
    throw error;
  }

  const response = await fetch(`${MERCHANT_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const body = parseJson(
    await response.text(),
    response.status,
    "Merchant API",
  );

  if (response.status === 401) {
    // Surface Salla's own reason (invalid token, missing scope, inactive user…)
    const reason = body.error?.message || "no reason given";
    const error = new Error(
      `Salla rejected SALLA_ACCESS_TOKEN: ${reason} (token starts with "${accessToken.slice(0, 7)}…", length ${accessToken.length})`,
    );
    error.code = /scope/i.test(reason) ? "missing_scope" : "token_expired";
    throw error;
  }

  return { status: response.status, body };
}
