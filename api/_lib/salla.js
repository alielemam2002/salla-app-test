/**
 * Salla helpers shared by the serverless functions:
 * - embedded token introspection (who is the merchant?)
 * - per-merchant OAuth token storage (filled by the app.store.authorize webhook)
 * - token refresh with a per-merchant lock (refresh tokens are single-use)
 * - authenticated Merchant API calls
 */

import { redis } from "./redis.js";

const INTROSPECT_URL = "https://api.salla.dev/exchange-authority/v1/introspect";
const OAUTH_TOKEN_URL = "https://accounts.salla.sa/oauth2/token";
const MERCHANT_API_BASE = "https://api.salla.dev/admin/v2";

// Refresh a little before the access token actually expires
const REFRESH_MARGIN_SECONDS = 5 * 60;
const LOCK_TTL_SECONDS = 30;

const tokenKey = (merchantId) => `salla:tokens:${merchantId}`;
const lockKey = (merchantId) => `salla:refresh-lock:${merchantId}`;

const nowSeconds = () => Math.floor(Date.now() / 1000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Salla sends `expires` as a Unix timestamp in app.store.authorize, but as a
 * duration in seconds from the token endpoint. Normalise to a timestamp.
 */
function toExpiresAt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return nowSeconds() + 14 * 24 * 3600;
  return n > 1e9 ? n : nowSeconds() + n;
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

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return {
      ok: false,
      status: 502,
      error: `Introspect returned non-JSON (status ${response.status})`,
    };
  }

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
// Token storage
// ============================================

export async function saveMerchantTokens(merchantId, data) {
  const record = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: toExpiresAt(data.expires ?? data.expires_in),
    scope: data.scope,
    updated_at: nowSeconds(),
  };
  await redis(["SET", tokenKey(merchantId), JSON.stringify(record)]);
  return record;
}

export async function getMerchantTokens(merchantId) {
  const raw = await redis(["GET", tokenKey(merchantId)]);
  return raw ? JSON.parse(raw) : null;
}

export async function deleteMerchantTokens(merchantId) {
  await redis(["DEL", tokenKey(merchantId), lockKey(merchantId)]);
}

// ============================================
// Refresh (single-use refresh tokens → lock per merchant)
// ============================================

async function requestNewTokens(refreshToken) {
  const clientId = process.env.SALLA_CLIENT_ID;
  const clientSecret = process.env.SALLA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Access token expired and SALLA_CLIENT_ID / SALLA_CLIENT_SECRET are not set",
    );
  }

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(
      `Token refresh failed: ${body.error_description || body.error || response.status}`,
    );
  }
  return body;
}

/**
 * Refresh the merchant's access token. Only one caller refreshes at a time;
 * others wait for the new token instead of reusing the old refresh token
 * (reuse would revoke the merchant's tokens entirely).
 */
export async function refreshMerchantTokens(merchantId, staleAccessToken) {
  const acquired = await redis([
    "SET",
    lockKey(merchantId),
    "1",
    "NX",
    "EX",
    String(LOCK_TTL_SECONDS),
  ]);

  if (acquired !== "OK") {
    // Someone else is refreshing: wait for their result
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      const current = await getMerchantTokens(merchantId);
      if (current && current.access_token !== staleAccessToken) return current;
    }
    throw new Error("Timed out waiting for a concurrent token refresh");
  }

  try {
    // Re-read under the lock: another request may have just refreshed
    const current = await getMerchantTokens(merchantId);
    if (!current) throw new Error("No stored tokens for this merchant");
    if (current.access_token !== staleAccessToken) return current;

    const fresh = await requestNewTokens(current.refresh_token);
    return await saveMerchantTokens(merchantId, fresh);
  } finally {
    await redis(["DEL", lockKey(merchantId)]);
  }
}

// ============================================
// Merchant API
// ============================================

/**
 * Call the Merchant API on behalf of a merchant, refreshing the access token
 * when it is about to expire or when Salla answers 401.
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function merchantApi(merchantId, path) {
  let tokens = await getMerchantTokens(merchantId);
  if (!tokens) {
    const error = new Error(
      "No access token stored for this store. Reinstall the app so Salla sends app.store.authorize to the webhook.",
    );
    error.code = "not_installed";
    throw error;
  }

  if (tokens.expires_at - nowSeconds() < REFRESH_MARGIN_SECONDS) {
    tokens = await refreshMerchantTokens(merchantId, tokens.access_token);
  }

  const call = (accessToken) =>
    fetch(`${MERCHANT_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

  let response = await call(tokens.access_token);
  if (response.status === 401) {
    tokens = await refreshMerchantTokens(merchantId, tokens.access_token);
    response = await call(tokens.access_token);
  }

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = {
      success: false,
      error: {
        message: `Merchant API returned non-JSON (status ${response.status})`,
      },
    };
  }
  return { status: response.status, body };
}
