/**
 * The Meta app's webhook (WhatsApp), served by api/salla-webhook.js: the
 * Hobby plan allows 12 functions, so /api/meta-webhook is a rewrite to it
 * (vercel.json). Meta's deliveries are told apart by X-Hub-Signature-256,
 * which Salla never sends; Salla never sends GET.
 *
 * Callback URL in the Meta app dashboard (WhatsApp → Configuration):
 * https://<domain>/api/meta-webhook, verify token = META_WEBHOOK_VERIFY_TOKEN.
 * Merchants' WABAs are subscribed to it when they connect with Embedded
 * Signup (POST /{waba-id}/subscribed_apps, api/_lib/metaSignup.js).
 * docs: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 *
 * - GET: Meta's verification handshake (hub.mode=subscribe, hub.verify_token
 *   must match; answer hub.challenge as plain text).
 * - POST: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(raw body,
 *   META_APP_SECRET), compared timing-safe. Deliveries are acknowledged
 *   only for now (no delivery/read statuses yet). Bodies carry customers'
 *   numbers and messages: never log them.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const env = (name) => String(process.env[name] || "").trim();

function safeEqual(given, expected) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A Meta delivery (signed with the app secret), not a Salla one. */
export const isMetaDelivery = (headers) => headers.has("x-hub-signature-256");

/** Is this delivery really from Meta? `raw` = the body bytes (Buffer). */
export function verifyMetaSignature(header, raw, appSecret) {
  if (!appSecret) return false;
  const given = String(header || "")
    .trim()
    .toLowerCase();
  const expected = `sha256=${createHmac("sha256", appSecret).update(raw).digest("hex")}`;
  return safeEqual(given, expected);
}

/** GET: Meta's verification handshake. */
export function metaVerification(request) {
  const params = new URL(request.url).searchParams;
  const expected = env("META_WEBHOOK_VERIFY_TOKEN");
  if (
    expected &&
    params.get("hub.mode") === "subscribe" &&
    safeEqual(params.get("hub.verify_token") || "", expected)
  ) {
    return new Response(params.get("hub.challenge") || "", {
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response("Forbidden", { status: 403 });
}

/** POST: check the signature, then acknowledge. */
export function metaDelivery(headers, raw) {
  const secret = env("META_APP_SECRET");
  if (!secret) {
    return Response.json(
      { success: false, error: "META_APP_SECRET is not set" },
      { status: 503 },
    );
  }
  if (!verifyMetaSignature(headers.get("x-hub-signature-256"), raw, secret)) {
    return Response.json(
      { success: false, error: "invalid signature" },
      { status: 401 },
    );
  }
  let payload = {};
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return Response.json(
      { success: false, error: "invalid JSON" },
      { status: 400 },
    );
  }
  // Only which fields arrived, never their content.
  const fields = (payload.entry || []).flatMap((entry) =>
    (entry.changes || []).map((change) => change.field),
  );
  if (fields.length) console.info("Meta webhook:", fields.join(","));
  return Response.json({ success: true });
}
