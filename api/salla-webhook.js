/**
 * Vercel Serverless Function - Salla webhooks (app + store events).
 *
 * This is the app's webhook_url (Partners Portal / salla_apps connect, with
 * webhook_security_strategy "signature"). App events (app.*) arrive here
 * automatically; store events (order.*) need a subscription. Put the app's
 * current webhook secret in SALLA_WEBHOOK_SECRET.
 * docs: https://docs.salla.dev/webhooks.md
 *
 * Security (X-Salla-Security-Strategy):
 * - Signature (default): X-Salla-Signature = HMAC-SHA256(raw body, secret), hex
 * - Token: the Authorization header equals the secret
 * Both are compared timing-safe, over the raw bytes as received.
 *
 * Handled events:
 * - app.store.authorize → save this store's OAuth tokens (Easy Mode: the
 *   only way the app gets them; encrypted, api/_lib/merchantTokens.js)
 * - app.uninstalled → forget this store's tokens
 * - order.created → replenishment reminders for products with a cycle
 *   (api/_lib/replenish.js; no Salla API call), then stock alerts for
 *   products at or under the merchant's threshold (api/_lib/stockAlerts.js)
 * - order.cancelled / order.refunded / order.deleted → that order's
 *   replenishment reminders are cancelled
 * Every other event is acknowledged and ignored. Request bodies are never
 * logged: app.store.authorize carries the tokens.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { kvConfigured } from "./_lib/kv.js";
import { encryptionConfigured } from "./_lib/secretBox.js";
import { sallaApiFor } from "./_lib/salla.js";
import {
  deleteTokens,
  parseAuthorize,
  saveTokens,
} from "./_lib/merchantTokens.js";
import { recordOrderAlerts } from "./_lib/stockAlerts.js";
import { cancelOrderReminders, scheduleFromOrder } from "./_lib/replenish.js";

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

const CANCEL_EVENTS = new Set([
  "order.cancelled",
  "order.refunded",
  "order.deleted",
]);

// Retrying won't help until someone replaces the token or adds the scope.
const PERMANENT = new Set([
  "store_not_authorized",
  "token_expired",
  "missing_scope",
  "oauth_not_configured",
]);

/** app.store.authorize / app.uninstalled for `merchantId`. */
async function handleAppEvent(event, merchantId, data) {
  if (!merchantId) return fail(400, "Missing merchant");
  // Storage down: 503 so Salla retries (tokens are sent only once).
  if (!kvConfigured() || !encryptionConfigured()) {
    console.error("Webhook app event: storage or WA_SETTINGS_KEY missing");
    return fail(503, "Storage is not configured");
  }
  if (event === "app.uninstalled") {
    await deleteTokens(merchantId);
    return ok({ handled: true });
  }
  const tokens = parseAuthorize(data);
  if (!tokens) {
    // Log the shape only, never the values.
    console.error(
      "app.store.authorize: malformed data",
      Object.keys(data || {}),
    );
    return fail(400, "Malformed app.store.authorize payload");
  }
  await saveTokens(merchantId, tokens);
  if (!tokens.scope.split(/\s+/).includes("offline_access")) {
    console.warn(
      `Store ${merchantId} authorized without offline_access: no refresh.`,
    );
  }
  return ok({ handled: true });
}

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
  if (event === "app.store.authorize" || event === "app.uninstalled") {
    try {
      return await handleAppEvent(event, merchantId, payload.data);
    } catch (error) {
      console.error(`Webhook ${event} failed:`, error.code || error.message);
      return fail(500, "Temporary failure");
    }
  }
  if (event !== "order.created" && !CANCEL_EVENTS.has(event)) {
    return ok({ handled: false });
  }
  if (!merchantId || !kvConfigured()) {
    return ok({ handled: false, reason: "storage_not_configured" });
  }

  if (CANCEL_EVENTS.has(event)) {
    try {
      const cancelled = await cancelOrderReminders(
        merchantId,
        payload.data?.id,
      );
      return ok({ handled: true, cancelled });
    } catch (error) {
      console.error(`Webhook ${event} failed:`, error.code || error.message);
      return fail(500, "Temporary failure");
    }
  }

  // Replenishment first: it only uses the payload and storage.
  let reminders = 0;
  try {
    reminders = await scheduleFromOrder(merchantId, payload.data);
  } catch (error) {
    console.error("Webhook replenish failed:", error.code || error.message);
    return fail(500, "Temporary failure");
  }

  try {
    // The store's own token: the signed payload names the store.
    const alerts = await recordOrderAlerts(
      sallaApiFor(merchantId),
      merchantId,
      payload.data,
    );
    return ok({ handled: true, alerts, reminders });
  } catch (error) {
    console.error("Webhook order.created failed:", error.code || error.message);
    if (PERMANENT.has(error.code)) {
      return ok({ handled: false, reason: error.code, reminders });
    }
    // Salla retries failed deliveries (about every 5 minutes, 3 times).
    return fail(500, "Temporary failure");
  }
}
