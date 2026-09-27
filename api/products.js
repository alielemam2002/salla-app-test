/**
 * Vercel Serverless Function - List Store Products
 *
 * POST /api/products  { token, appId?, page?, perPage? }
 *
 * 1. Verifies the embedded session token via Salla introspect
 * 2. Calls GET /admin/v2/products with the store access token from the
 *    SALLA_ACCESS_TOKEN env var
 */

import { introspectEmbeddedToken, merchantApi } from "./_lib/salla.js";

const MAX_PER_PAGE = 60; // Salla's per_page limit

const ERROR_STATUS = {
  token_not_configured: 500,
  token_expired: 401,
  missing_scope: 403,
};

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

  try {
    const session = await introspectEmbeddedToken(token, appId);
    if (!session.ok) {
      return fail(session.status, "session_invalid", session.error);
    }

    const { status, body: result } = await merchantApi(
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
      merchantId: session.data.merchant_id,
      products: result.data || [],
      pagination: result.pagination || null,
    });
  } catch (error) {
    console.error("Products fetch failed:", error);
    return fail(
      ERROR_STATUS[error.code] || 500,
      error.code || "server_error",
      error.message || "Internal server error",
    );
  }
}
