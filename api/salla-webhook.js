/**
 * Vercel Serverless Function - Salla webhooks (store events).
 *
 * Register this URL (https://<your-domain>/api/salla-webhook) in the
 * Partners Portal: My Apps → the app → Webhooks/Notifications, and add the
 * `order.created` event. Put the app's webhook secret in SALLA_WEBHOOK_SECRET.
 * docs: https://docs.salla.dev/webhooks.md
 *
 * Security (X-Salla-Security-Strategy):
 * - Signature (default): X-Salla-Signature = HMAC-SHA256(raw body, secret), hex
 * - Token: the Authorization header equals the secret
 * Both are compared timing-safe, over the raw bytes as received.
 *
 * Handled events:
 * - order.created → stock alerts for products at or under the merchant's
 *   threshold (api/_lib/stockAlerts.js)
 * Every other event (including app events, which can carry OAuth tokens) is
 * acknowledged and ignored; request bodies are never logged.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { kvConfigured } from "./_lib/kv.js";
import { tokenStoreId } from "./_lib/salla.js";
import { recordOrderAlerts } from "./_lib/stockAlerts.js";

const ok = (extra = {}) => Response.json({ success: true, ...extra });
const fail = (status, error) =>
  Response.json({ success: false, error }, { status });

function safeEqual(given, expected) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Is this delivery really from Salla? `raw` = the body bytes (Buffer). */
export function verifySallaWebhook(headers, raw, secret) {
  const strategy = (headers.get("x-salla-security-strategy") || "Signature")
    .trim()
    .toLowerCase();
  if (strategy === "token") {
    const given = (headers.get("authorization") || "")
      .trim()
      .replace(/^Bearer\s+/i, "");
    return safeEqual(given, secret);
  }
  const signature = (headers.get("x-salla-signature") || "")
    .trim()
    .toLowerCase();
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  return safeEqual(signature, expected);
}

// Which store SALLA_ACCESS_TOKEN belongs to, cached for a few minutes.
const STORE_TTL_MS = 10 * 60 * 1000;
let storeCache = { at: 0, value: null };
async function cachedStoreId() {
  if (storeCache.value?.ok && Date.now() - storeCache.at < STORE_TTL_MS) {
    return storeCache.value;
  }
  const value = await tokenStoreId();
  storeCache = { at: Date.now(), value };
  return value;
}
export const resetStoreCache = () => {
  storeCache = { at: 0, value: null };
};

// Retrying won't help until someone replaces the token or adds the scope.
const PERMANENT = new Set([
  "token_expired",
  "missing_scope",
  "token_not_configured",
]);

export async function POST(request) {
  const secret = process.env.SALLA_WEBHOOK_SECRET;
  if (!secret) return fail(503, "SALLA_WEBHOOK_SECRET is not set");

  const raw = Buffer.from(await request.arrayBuffer());
  if (!verifySallaWebhook(request.headers, raw, secret)) {
    return fail(401, "Invalid webhook signature");
  }
  let payload;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return fail(400, "Invalid JSON");
  }

  const event = String(payload?.event || "");
  const merchantId = String(payload?.merchant ?? "");
  if (event !== "order.created") return ok({ handled: false });
  if (!merchantId || !kvConfigured()) {
    return ok({ handled: false, reason: "storage_not_configured" });
  }

  // One SALLA_ACCESS_TOKEN: only its own store's products can be read.
  const store = await cachedStoreId();
  if (!store.ok || store.id !== merchantId) {
    return ok({ handled: false, reason: "other_store" });
  }

  try {
    const alerts = await recordOrderAlerts(merchantId, payload.data);
    return ok({ handled: true, alerts });
  } catch (error) {
    console.error("Webhook order.created failed:", error.code || error.message);
    if (PERMANENT.has(error.code)) {
      return ok({ handled: false, reason: error.code });
    }
    // Salla retries failed deliveries (about every 5 minutes, 3 times).
    return fail(500, "Temporary failure");
  }
}
