/**
 * Vercel Serverless Function - List Store Products
 *
 * POST /api/products  { token, appId?, page?, perPage? }
 *
 * 1. Verifies the embedded session token via Salla introspect → merchant_id
 * 2. Looks up that merchant's stored OAuth access token (see api/webhook.js)
 * 3. Calls GET /admin/v2/products on the merchant's behalf
 */

import { isRedisConfigured } from "./_lib/redis.js";
import { introspectEmbeddedToken, merchantApi } from "./_lib/salla.js";

const MAX_PER_PAGE = 60; // Salla's per_page limit

const fail = (status, code, error) =>
  Response.json({ success: false, code, error }, { status });

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "Invalid JSON body");
  }

  const { token } = body;
  // Prefer the server-side App ID; fall back to the one the page sends
  const appId = process.env.SALLA_APP_ID || body.appId;
  const page = Math.max(1, parseInt(body.page, 10) || 1);
  const perPage = Math.min(
    MAX_PER_PAGE,
    Math.max(1, parseInt(body.perPage, 10) || 30),
  );

  if (!token) return fail(400, "bad_request", "Token is required");
  if (!appId) return fail(400, "bad_request", "App ID is required");
  if (!isRedisConfigured()) {
    return fail(
      500,
      "storage_not_configured",
      "Redis is not configured. Add Upstash Redis to the Vercel project.",
    );
  }

  try {
    const session = await introspectEmbeddedToken(token, appId);
    if (!session.ok) {
      return fail(session.status, "session_invalid", session.error);
    }

    const merchantId = session.data.merchant_id;
    const { status, body: result } = await merchantApi(
      merchantId,
      `/products?page=${page}&per_page=${perPage}`,
    );

    if (!result.success) {
      return fail(
        status >= 400 ? status : 502,
        "salla_api_error",
        result.error?.message || `Salla API error (status ${status})`,
      );
    }

    return Response.json({
      success: true,
      merchantId,
      products: result.data || [],
      pagination: result.pagination || null,
    });
  } catch (error) {
    console.error("Products fetch failed:", error);
    return fail(
      error.code === "not_installed" ? 404 : 500,
      error.code || "server_error",
      error.message || "Internal server error",
    );
  }
}
