/**
 * Salla OAuth tokens per store (Easy Mode). Nothing is kept in env: Salla
 * sends each store's tokens in the `app.store.authorize` webhook when the
 * app is installed and again on every app update (api/salla-webhook.js).
 * docs: https://docs.salla.dev/421118m0.md · https://docs.salla.dev/421413m0.md
 *
 * Stored in Upstash Redis under `salla:tokens:{merchant}`, both tokens
 * encrypted with secretBox (WA_SETTINGS_KEY). Never logged, never returned
 * to the browser.
 *
 * Refresh tokens are single-use: using one twice revokes the whole chain and
 * the merchant must reinstall. So a refresh only runs under a per-store lock,
 * re-reads the record inside it, and saves BOTH new tokens before releasing
 * it. Refresh is proactive (a day before `expires`), not on a 401.
 *
 * Env: SALLA_CLIENT_ID / SALLA_CLIENT_SECRET (refresh), WA_SETTINGS_KEY.
 */

import { randomUUID } from "node:crypto";
import {
  kvDel,
  kvDelIfValue,
  kvGetJson,
  kvSetIfAbsent,
  kvSetJson,
} from "./kv.js";
import { open, seal } from "./secretBox.js";

const TOKEN_URL = "https://accounts.salla.sa/oauth2/token";
const REFRESH_BEFORE_MS = 24 * 60 * 60 * 1000;
const LOCK_SECONDS = 30;
const WAIT_STEPS = 10;
const WAIT_MS = 500;

const tokensKey = (merchantId) => `salla:tokens:${merchantId}`;
const lockKey = (merchantId) => `salla:token-refresh:${merchantId}`;

export const NOT_AUTHORIZED_MESSAGE =
  "لم يستلم التطبيق صلاحية الوصول لمتجرك بعد. أعد تثبيت التطبيق من لوحة تحكم سلة ثم افتحه مرة أخرى.";

function failure(code, status, message) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

const notAuthorized = (message = NOT_AUTHORIZED_MESSAGE) =>
  failure("store_not_authorized", 403, message);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * app.store.authorize `data` → { accessToken, refreshToken, expiresAt,
 * scope }, or null when it's not a usable token payload. `expires` is an
 * absolute Unix timestamp in seconds, not a duration.
 */
export function parseAuthorize(data) {
  const expires = Number(data?.expires);
  if (
    typeof data?.access_token !== "string" ||
    !data.access_token ||
    typeof data.refresh_token !== "string" ||
    !data.refresh_token ||
    !Number.isFinite(expires) ||
    String(data.token_type || "bearer").toLowerCase() !== "bearer"
  ) {
    return null;
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: expires * 1000,
    scope: String(data.scope || ""),
  };
}

/** Upsert a store's tokens (install, app update, refresh). */
export async function saveTokens(merchantId, tokens) {
  await kvSetJson(tokensKey(merchantId), {
    access: seal(tokens.accessToken),
    refresh: seal(tokens.refreshToken),
    expiresAt: tokens.expiresAt,
    scope: tokens.scope || "",
    revoked: false,
    updatedAt: new Date().toISOString(),
  });
}

/** app.uninstalled: the tokens are dead, forget them. */
export function deleteTokens(merchantId) {
  return kvDel(tokensKey(merchantId));
}

function load(merchantId) {
  return kvGetJson(tokensKey(merchantId));
}

/** What the app may say about a store's access (no token values). */
export async function tokenStatus(merchantId) {
  const record = await load(merchantId);
  if (!record || record.revoked) {
    return { authorized: false, revoked: Boolean(record?.revoked) };
  }
  const scopes = String(record.scope || "")
    .split(/\s+/)
    .filter(Boolean);
  return {
    authorized: true,
    expiresAt: new Date(record.expiresAt).toISOString(),
    // Without offline_access Salla issues no usable refresh token.
    offlineAccess: scopes.includes("offline_access"),
    scopes,
  };
}

/** Salla's refresh answer → our token shape (expires or expires_in). */
function readRefreshAnswer(json, now) {
  const expires = Number(json.expires);
  const expiresIn = Number(json.expires_in);
  const expiresAt = Number.isFinite(expires)
    ? expires * 1000
    : Number.isFinite(expiresIn)
      ? now + expiresIn * 1000
      : NaN;
  if (
    !json.access_token ||
    !json.refresh_token ||
    !Number.isFinite(expiresAt)
  ) {
    return null;
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt,
    scope: json.scope || "",
  };
}

async function requestRefresh(refreshToken) {
  const clientId = process.env.SALLA_CLIENT_ID;
  const clientSecret = process.env.SALLA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw failure(
      "oauth_not_configured",
      500,
      "إعداد التطبيق على الخادم غير مكتمل (SALLA_CLIENT_ID و SALLA_CLIENT_SECRET)، لذلك لا يمكن تجديد صلاحية الوصول.",
    );
  }
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  let json = {};
  try {
    json = await response.json();
  } catch {
    // handled below
  }
  const tokens = response.ok ? readRefreshAnswer(json, Date.now()) : null;
  if (tokens) return tokens;
  // 400/401 (invalid_grant…): the chain is dead, only a reinstall helps.
  if (response.status === 400 || response.status === 401) {
    const error = notAuthorized(
      "انتهت صلاحية وصول التطبيق لمتجرك ولم يمكن تجديدها. أعد تثبيت التطبيق من لوحة تحكم سلة.",
    );
    error.revoked = true;
    throw error;
  }
  throw failure(
    "token_refresh_failed",
    502,
    "تعذّر تجديد صلاحية الوصول لمتجرك الآن. حاول مرة أخرى بعد قليل.",
  );
}

/** Refresh under the per-store lock; exported for tests. */
export async function refreshTokenSafe(merchantId) {
  const owner = randomUUID();
  if (await kvSetIfAbsent(lockKey(merchantId), owner, LOCK_SECONDS)) {
    try {
      // Re-read inside the lock: another request may have refreshed.
      const record = await load(merchantId);
      if (!record || record.revoked) throw notAuthorized();
      if (record.expiresAt - Date.now() > REFRESH_BEFORE_MS) {
        return open(record.access);
      }
      let fresh;
      try {
        fresh = await requestRefresh(open(record.refresh));
      } catch (error) {
        if (error.revoked) {
          await kvSetJson(tokensKey(merchantId), { ...record, revoked: true });
        }
        throw error;
      }
      // Save BOTH before releasing the lock: the old refresh token is dead.
      await saveTokens(merchantId, {
        ...fresh,
        scope: fresh.scope || record.scope,
      });
      return fresh.accessToken;
    } finally {
      await kvDelIfValue(lockKey(merchantId), owner);
    }
  }

  // Someone else is refreshing: wait for their tokens, never refresh twice.
  for (let i = 0; i < WAIT_STEPS; i += 1) {
    await sleep(WAIT_MS);
    const record = await load(merchantId);
    if (record && !record.revoked) {
      if (record.expiresAt - Date.now() > REFRESH_BEFORE_MS) {
        return open(record.access);
      }
    }
  }
  const record = await load(merchantId);
  if (record && !record.revoked && record.expiresAt > Date.now()) {
    return open(record.access); // not refreshed yet, but still valid
  }
  throw failure(
    "token_refreshing",
    503,
    "يجري تجديد صلاحية الوصول لمتجرك. حاول مرة أخرى بعد لحظات.",
  );
}

/** A valid access token for this store, refreshed a day before expiry. */
export async function getAccessToken(merchantId) {
  const record = await load(merchantId);
  if (!record) throw notAuthorized();
  if (record.revoked) {
    throw notAuthorized(
      "انتهت صلاحية وصول التطبيق لمتجرك. أعد تثبيت التطبيق من لوحة تحكم سلة.",
    );
  }
  if (record.expiresAt - Date.now() > REFRESH_BEFORE_MS) {
    return open(record.access);
  }
  return refreshTokenSafe(merchantId);
}
