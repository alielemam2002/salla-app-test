/**
 * Vercel Serverless Function - Store Products CRUD & Management
 *
 * Handles:
 * - list: GET /admin/v2/products (page, perPage, keyword, status, category)
 * - get: GET /admin/v2/products/{id}
 * - create: POST /admin/v2/products
 * - update: PUT /admin/v2/products/{id}
 * - delete: DELETE /admin/v2/products/{id}
 * - taxonomies: GET /categories & GET /brands (graceful fallback if scopes absent)
 *
 * Authentication:
 * 1. Verifies the embedded session token via Salla introspect
 * 2. Uses the store's OAuth access token from SALLA_ACCESS_TOKEN
 */

import { introspectEmbeddedToken, merchantApi } from "./_lib/salla.js";

const MAX_PER_PAGE = 60; // Salla's per_page limit

const ERROR_STATUS = {
  token_not_configured: 500,
  token_expired: 401,
  missing_scope: 403,
  validation_failed: 422,
};

const fail = (status, code, error, fields = null) =>
  Response.json(
    { success: false, code, error, ...(fields ? { fields } : {}) },
    { status },
  );

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "Invalid JSON body");
  }

  const { token } = body;
  const appId = process.env.SALLA_APP_ID || body.appId;
  const action = (body.action || "list").toLowerCase();

  if (!token) return fail(400, "bad_request", "Token is required");
  if (!appId) return fail(400, "bad_request", "App ID is required");

  try {
    // 1. Verify caller session with Salla exchange authority
    const session = await introspectEmbeddedToken(token, appId);
    if (!session.ok) {
      return fail(session.status, "session_invalid", session.error);
    }

    // 2. Dispatch requested action
    switch (action) {
      // -----------------------------------------------------------------------
      // LIST / SEARCH PRODUCTS
      // -----------------------------------------------------------------------
      case "list": {
        const page = Math.max(1, parseInt(body.page, 10) || 1);
        const perPage = Math.min(
          MAX_PER_PAGE,
          Math.max(1, parseInt(body.perPage, 10) || 30),
        );

        const params = new URLSearchParams({
          page: String(page),
          per_page: String(perPage),
        });

        if (
          body.keyword &&
          typeof body.keyword === "string" &&
          body.keyword.trim()
        ) {
          params.set("keyword", body.keyword.trim());
        }
        if (
          body.status &&
          typeof body.status === "string" &&
          body.status.trim()
        ) {
          params.set("status", body.status.trim());
        }
        if (
          body.category !== undefined &&
          body.category !== null &&
          String(body.category).trim() !== ""
        ) {
          params.set("category", String(body.category).trim());
        }

        const { status, body: result } = await merchantApi(
          `/products?${params.toString()}`,
        );

        if (!result.success) {
          return fail(
            status >= 400 ? status : 502,
            "salla_api_error",
            result.error?.message || `Salla API error (status ${status})`,
            result.error?.fields,
          );
        }

        return Response.json({
          success: true,
          merchantId: session.data.merchant_id,
          products: result.data || [],
          pagination: result.pagination || null,
        });
      }

      // -----------------------------------------------------------------------
      // GET SINGLE PRODUCT DETAILS
      // -----------------------------------------------------------------------
      case "get": {
        const productId = body.productId;
        if (!productId) {
          return fail(400, "bad_request", "Product ID is required");
        }

        const { status, body: result } = await merchantApi(
          `/products/${encodeURIComponent(productId)}`,
        );

        if (!result.success) {
          return fail(
            status >= 400 ? status : 502,
            "salla_api_error",
            result.error?.message ||
              `Failed to fetch product (status ${status})`,
          );
        }

        return Response.json({
          success: true,
          product: result.data,
        });
      }

      // -----------------------------------------------------------------------
      // CREATE PRODUCT
      // -----------------------------------------------------------------------
      case "create": {
        const productData = body.productData;
        if (!productData || typeof productData !== "object") {
          return fail(400, "bad_request", "Product data object is required");
        }

        // Validate basic required fields according to Salla OpenAPI specification
        if (!productData.name || !String(productData.name).trim()) {
          return fail(422, "validation_failed", "Product name is required", {
            name: ["Product name is required"],
          });
        }
        if (
          productData.price === undefined ||
          productData.price === null ||
          isNaN(Number(productData.price))
        ) {
          return fail(
            422,
            "validation_failed",
            "A valid product price is required",
            {
              price: ["A valid product price is required"],
            },
          );
        }

        const payload = {
          ...productData,
          name: String(productData.name).trim(),
          price: Number(productData.price),
          product_type: productData.product_type || "product",
        };

        // Normalize optional numerical fields
        if (
          payload.quantity !== undefined &&
          payload.quantity !== null &&
          payload.quantity !== ""
        ) {
          payload.quantity = Number(payload.quantity);
        }
        if (
          payload.sale_price !== undefined &&
          payload.sale_price !== null &&
          payload.sale_price !== ""
        ) {
          payload.sale_price = Number(payload.sale_price);
        }
        if (
          payload.cost_price !== undefined &&
          payload.cost_price !== null &&
          payload.cost_price !== ""
        ) {
          payload.cost_price = Number(payload.cost_price);
        }
        if (
          payload.weight !== undefined &&
          payload.weight !== null &&
          payload.weight !== ""
        ) {
          payload.weight = Number(payload.weight);
        }
        if (
          payload.brand_id !== undefined &&
          payload.brand_id !== null &&
          payload.brand_id !== ""
        ) {
          payload.brand_id = Number(payload.brand_id);
        }

        const { status, body: result } = await merchantApi("/products", {
          method: "POST",
          body: payload,
        });

        if (!result.success) {
          return fail(
            status >= 400 ? status : 422,
            "salla_api_error",
            result.error?.message ||
              `Failed to create product (status ${status})`,
            result.error?.fields,
          );
        }

        return Response.json(
          {
            success: true,
            product: result.data,
            message: "Product created successfully",
          },
          { status: 201 },
        );
      }

      // -----------------------------------------------------------------------
      // UPDATE PRODUCT
      // -----------------------------------------------------------------------
      case "update": {
        const productId = body.productId;
        const productData = body.productData;

        if (!productId) {
          return fail(400, "bad_request", "Product ID is required");
        }
        if (!productData || typeof productData !== "object") {
          return fail(400, "bad_request", "Product data object is required");
        }

        const payload = { ...productData };
        if (payload.name) payload.name = String(payload.name).trim();
        if (
          payload.price !== undefined &&
          payload.price !== null &&
          payload.price !== ""
        ) {
          payload.price = Number(payload.price);
        }
        if (
          payload.quantity !== undefined &&
          payload.quantity !== null &&
          payload.quantity !== ""
        ) {
          payload.quantity = Number(payload.quantity);
        }
        if (
          payload.sale_price !== undefined &&
          payload.sale_price !== null &&
          payload.sale_price !== ""
        ) {
          payload.sale_price = Number(payload.sale_price);
        }
        if (
          payload.cost_price !== undefined &&
          payload.cost_price !== null &&
          payload.cost_price !== ""
        ) {
          payload.cost_price = Number(payload.cost_price);
        }
        if (
          payload.weight !== undefined &&
          payload.weight !== null &&
          payload.weight !== ""
        ) {
          payload.weight = Number(payload.weight);
        }
        if (
          payload.brand_id !== undefined &&
          payload.brand_id !== null &&
          payload.brand_id !== ""
        ) {
          payload.brand_id = Number(payload.brand_id);
        }

        // Remove immutable fields on update if provided
        delete payload.product_type;
        delete payload.id;

        const { status, body: result } = await merchantApi(
          `/products/${encodeURIComponent(productId)}`,
          {
            method: "PUT",
            body: payload,
          },
        );

        if (!result.success) {
          return fail(
            status >= 400 ? status : 422,
            "salla_api_error",
            result.error?.message ||
              `Failed to update product (status ${status})`,
            result.error?.fields,
          );
        }

        return Response.json({
          success: true,
          product: result.data,
          message: "Product updated successfully",
        });
      }

      // -----------------------------------------------------------------------
      // DELETE PRODUCT
      // -----------------------------------------------------------------------
      case "delete": {
        const productId = body.productId;
        if (!productId) {
          return fail(400, "bad_request", "Product ID is required");
        }

        const { status, body: result } = await merchantApi(
          `/products/${encodeURIComponent(productId)}`,
          {
            method: "DELETE",
          },
        );

        if (!result.success) {
          return fail(
            status >= 400 ? status : 502,
            "salla_api_error",
            result.error?.message ||
              `Failed to delete product (status ${status})`,
          );
        }

        return Response.json({
          success: true,
          productId,
          message: result.data?.message || "Product deleted successfully",
        });
      }

      // -----------------------------------------------------------------------
      // TAXONOMIES (Categories & Brands for Selectors)
      // -----------------------------------------------------------------------
      case "taxonomies": {
        let categories = [];
        let brands = [];

        try {
          const catRes = await merchantApi("/categories?per_page=60");
          if (catRes.body?.success && Array.isArray(catRes.body?.data)) {
            categories = catRes.body.data;
          }
        } catch (catErr) {
          console.warn("Could not load categories:", catErr.message);
        }

        try {
          const brandRes = await merchantApi("/brands?per_page=60");
          if (brandRes.body?.success && Array.isArray(brandRes.body?.data)) {
            brands = brandRes.body.data;
          }
        } catch (brandErr) {
          console.warn("Could not load brands:", brandErr.message);
        }

        return Response.json({
          success: true,
          categories,
          brands,
        });
      }

      default:
        return fail(400, "bad_request", `Unknown action: "${action}"`);
    }
  } catch (error) {
    console.error("Products endpoint failed:", error);
    return fail(
      error.status || ERROR_STATUS[error.code] || 500,
      error.code || "server_error",
      error.message || "Internal server error",
      error.details?.error?.fields || null,
    );
  }
}
