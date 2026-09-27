/**
 * Vercel Serverless Function - Salla App Webhook
 *
 * Set this URL as the app's Webhook URL in the Salla Partners Portal:
 *   https://<your-deployment>/api/webhook
 *
 * Stores each merchant's OAuth tokens on app.store.authorize (Easy Mode)
 * and removes them on app.uninstalled.
 */

import crypto from "node:crypto";
import { isRedisConfigured } from "./_lib/redis.js";
import { saveMerchantTokens, deleteMerchantTokens } from "./_lib/salla.js";

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Signature strategy: X-Salla-Signature = HMAC-SHA256(raw body, secret) hex.
 * Token strategy: Authorization header carries the secret.
 */
function isAuthentic(request, rawBody, secret) {
  const strategy = (
    request.headers.get("x-salla-security-strategy") || "signature"
  ).toLowerCase();

  if (strategy === "token") {
    const auth = request.headers.get("authorization") || "";
    return safeEqual(auth.replace(/^Bearer\s+/i, ""), secret);
  }

  const signature = request.headers.get("x-salla-signature") || "";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return safeEqual(signature, expected);
}

export async function POST(request) {
  const secret = process.env.SALLA_WEBHOOK_SECRET;
  if (!secret) {
    console.error("SALLA_WEBHOOK_SECRET is not set");
    return Response.json(
      { success: false, error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  // Verify against the raw bytes, never a re-serialised body
  const rawBody = await request.text();
  if (!isAuthentic(request, rawBody, secret)) {
    return Response.json(
      { success: false, error: "Invalid signature" },
      { status: 401 },
    );
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const { event, merchant, data } = payload;
  console.log("Salla webhook received", { event, merchant });

  if (!isRedisConfigured()) {
    console.error("Redis is not configured; cannot store tokens");
    return Response.json(
      { success: false, error: "Storage not configured" },
      { status: 500 },
    );
  }

  try {
    switch (event) {
      case "app.store.authorize":
        await saveMerchantTokens(merchant, data);
        break;
      case "app.uninstalled":
        await deleteMerchantTokens(merchant);
        break;
      default:
        // Other events are acknowledged and ignored
        break;
    }
  } catch (error) {
    console.error("Webhook handling failed:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }

  return Response.json({ success: true });
}
