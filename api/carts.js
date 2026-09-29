/**
 * Vercel Serverless Function - Abandoned carts (Salla Merchant API)
 *
 * Handles (scope carts.read; product names need products.read):
 * - list: GET /admin/v2/carts/abandoned?page=&per_page=60
 *         docs: https://docs.salla.dev/abandoned-cart/list.md
 * - get:  GET /admin/v2/carts/abandoned/{cart-id}
 *         docs: https://docs.salla.dev/abandoned-cart/details.md
 *         Cart items only carry product_id, so product names come from
 *         GET /admin/v2/products/{id} (at most MAX_PRODUCT_LOOKUPS per cart).
 *
 * Read-only: nothing is sent to customers from here. Salla has no API for
 * an app to message a customer; the WhatsApp button in the UI opens a
 * wa.me link that the merchant sends from their own WhatsApp.
 *
 * Authentication:
 * 1. Verifies the embedded session token via Salla introspect
 * 2. Uses the store's OAuth access token from SALLA_ACCESS_TOKEN
 */

import { introspectEmbeddedToken, merchantApi } from "./_lib/salla.js";

const PER_PAGE = 60; // Salla's maximum for this endpoint
const MAX_PRODUCT_LOOKUPS = 20;
const LOOKUP_CONCURRENCY = 3;

const ERROR_STATUS = {
  token_not_configured: 500,
  token_expired: 401,
  missing_scope: 403,
};

const fail = (status, code, error, fields = null) =>
  Response.json(
    { success: false, status, code, error, ...(fields ? { fields } : {}) },
    { status },
  );

const sallaFail = (status, result, fallback) =>
  fail(
    status >= 400 ? status : 502,
    "salla_api_error",
    result?.error?.message || fallback,
    result?.error?.fields || null,
  );

/** Name + thumbnail for each product id, skipping any that fail. */
async function lookupProducts(productIds) {
  const ids = [...new Set(productIds.map(String))].slice(
    0,
    MAX_PRODUCT_LOOKUPS,
  );
  const products = {};
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next];
      next += 1;
      try {
        const { body } = await merchantApi(
          `/products/${encodeURIComponent(id)}`,
        );
        if (body?.success && body.data) {
          products[id] = {
            name: body.data.name || null,
            thumbnail: body.data.thumbnail || body.data.main_image || null,
          };
        }
      } catch {
        // A missing scope or deleted product only costs us the name.
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(LOOKUP_CONCURRENCY, ids.length) }, worker),
  );
  return products;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "Invalid JSON body");
  }

  const { token } = body;
  const appId = process.env.SALLA_APP_ID || body.appId;
  const action = String(body.action || "list").toLowerCase();

  if (!token) return fail(400, "bad_request", "Token is required");
  if (!appId) return fail(400, "bad_request", "App ID is required");

  try {
    const session = await introspectEmbeddedToken(token, appId);
    if (!session.ok) {
      return fail(session.status, "session_invalid", session.error);
    }

    switch (action) {
      case "list": {
        const params = new URLSearchParams({
          page: String(Math.max(1, parseInt(body.page, 10) || 1)),
          per_page: String(PER_PAGE),
        });
        const { status, body: result } = await merchantApi(
          `/carts/abandoned?${params.toString()}`,
        );
        if (!result.success) {
          return sallaFail(
            status,
            result,
            `Failed to load abandoned carts (status ${status})`,
          );
        }
        return Response.json({
          success: true,
          carts: Array.isArray(result.data) ? result.data : [],
          pagination: result.pagination || null,
        });
      }

      case "get": {
        const cartId = String(body.cartId || "");
        if (!/^\d+$/.test(cartId)) {
          return fail(400, "bad_request", "A numeric cart ID is required");
        }
        const { status, body: result } = await merchantApi(
          `/carts/abandoned/${encodeURIComponent(cartId)}`,
        );
        if (!result.success) {
          return sallaFail(
            status,
            result,
            `Failed to load the cart (status ${status})`,
          );
        }
        const items = Array.isArray(result.data?.items)
          ? result.data.items
          : [];
        const products = await lookupProducts(
          items.map((item) => item.product_id).filter(Boolean),
        );
        return Response.json({ success: true, cart: result.data, products });
      }

      default:
        return fail(400, "bad_request", `Unknown action: "${action}"`);
    }
  } catch (error) {
    console.error("Carts endpoint failed:", error.message);
    return fail(
      error.status || ERROR_STATUS[error.code] || 500,
      error.code || "server_error",
      error.message || "Internal server error",
    );
  }
}
