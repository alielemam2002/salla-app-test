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
        // Not in Salla's PUT /products/{id} schema (read-only on the response)
        delete payload.regular_price;
        delete payload.notify_quantity;

        if (payload.unlimited_quantity) {
          // Salla skips quantity when unlimited_quantity=true
          delete payload.quantity;
        } else if (
          payload.quantity !== undefined &&
          payload.quantity !== null &&
          payload.quantity !== ""
        ) {
          payload.quantity = Number(payload.quantity);
        }
        if (
          payload.maximum_quantity_per_order !== undefined &&
          payload.maximum_quantity_per_order !== null &&
          payload.maximum_quantity_per_order !== ""
        ) {
          payload.maximum_quantity_per_order = Number(
            payload.maximum_quantity_per_order,
          );
        }
        if (payload.hide_quantity !== undefined) {
          payload.hide_quantity = Boolean(payload.hide_quantity);
        }
        for (const dateField of ["sale_start", "sale_end"]) {
          if (payload[dateField] !== undefined) {
            payload[dateField] = payload[dateField] || null;
          }
        }
        if (
          payload.sale_price !== undefined &&
          payload.sale_price !== null &&
          payload.sale_price !== ""
        ) {
          payload.sale_price = Number(payload.sale_price);
        } else if (payload.sale_price === null) {
          payload.sale_price = null;
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

        if (payload.tags !== undefined) {
          // Salla's PUT expects tag IDs (numbers). New tags arrive as names
          // and are created first via POST /products/tags?tag_name=…
          const rawTags = Array.isArray(payload.tags)
            ? payload.tags
            : typeof payload.tags === "string"
              ? payload.tags.split(/[,;\n]+/)
              : [];
          const tagIds = [];
          for (const tag of rawTags) {
            const id = typeof tag === "object" ? tag?.id : tag;
            if (id !== undefined && id !== "" && !isNaN(Number(id))) {
              tagIds.push(Number(id));
              continue;
            }
            const name = String(
              typeof tag === "object" ? tag?.name || "" : tag,
            ).trim();
            if (!name) continue;
            const { status, body: created } = await merchantApi(
              `/products/tags?tag_name=${encodeURIComponent(name)}`,
              { method: "POST" },
            );
            const createdTag = Array.isArray(created.data)
              ? created.data[0]
              : created.data;
            if (!created.success || !createdTag?.id) {
              return fail(
                status >= 400 ? status : 502,
                "salla_api_error",
                created.error?.message || `Failed to create tag "${name}"`,
                created.error?.fields,
              );
            }
            tagIds.push(Number(createdTag.id));
          }
          payload.tags = [...new Set(tagIds)];
        }
        if (payload.metadata_title !== undefined) {
          payload.metadata_title = String(payload.metadata_title || "").trim();
        }
        if (payload.metadata_description !== undefined) {
          payload.metadata_description = String(
            payload.metadata_description || "",
          ).trim();
        }
        if (payload.metadata_url !== undefined) {
          payload.metadata_url = String(payload.metadata_url || "").trim();
        }
        if (payload.promotion_title !== undefined) {
          payload.promotion_title = String(
            payload.promotion_title || "",
          ).trim();
        }
        if (payload.subtitle !== undefined) {
          payload.subtitle = String(payload.subtitle || "").trim();
        }
        if (payload.gtin !== undefined) {
          payload.gtin = String(payload.gtin || "").trim();
        }
        if (payload.mpn !== undefined) {
          payload.mpn = String(payload.mpn || "").trim();
        }

        // Remove immutable or read-only fields on update
        delete payload.product_type;
        delete payload.id;
        delete payload.main_image;
        delete payload.thumbnail;

        // Normalize images array if present
        if (Array.isArray(payload.images)) {
          payload.images = payload.images.map((img, idx) => ({
            ...(img.id ? { id: img.id } : {}),
            original: img.original || img.url,
            default: Boolean(img.default),
            sort: img.sort !== undefined ? Number(img.sort) : idx + 1,
            alt: img.alt || "",
          }));
        }

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
      // OPTIONS MANAGEMENT (GET, CREATE, UPDATE, DELETE)
      // -----------------------------------------------------------------------
      case "options_list": {
        const productId = body.productId;
        if (!productId) {
          return fail(400, "bad_request", "Product ID is required");
        }

        let options = [];
        try {
          const res = await merchantApi(
            `/products/${encodeURIComponent(productId)}/options`,
          );
          if (res.body?.success && Array.isArray(res.body?.data)) {
            options = res.body.data;
          }
        } catch {
          // Fallback: check product details
          try {
            const pRes = await merchantApi(
              `/products/${encodeURIComponent(productId)}`,
            );
            options = pRes.body?.data?.options || [];
          } catch {
            options = [];
          }
        }

        return Response.json({ success: true, options });
      }

      case "option_create": {
        const productId = body.productId;
        const optionData = body.optionData;
        if (!productId) {
          return fail(400, "bad_request", "Product ID is required");
        }
        if (!optionData || typeof optionData !== "object") {
          return fail(400, "bad_request", "Option data is required");
        }

        const { status, body: result } = await merchantApi(
          `/products/${encodeURIComponent(productId)}/options`,
          {
            method: "POST",
            body: optionData,
          },
        );

        if (!result.success) {
          return fail(
            status >= 400 ? status : 422,
            "salla_api_error",
            result.error?.message ||
              `Failed to create option (status ${status})`,
            result.error?.fields,
          );
        }

        return Response.json({
          success: true,
          option: result.data,
          message: "Option created successfully",
        });
      }

      case "option_update": {
        const productId = body.productId;
        const optionId = body.optionId;
        const optionData = body.optionData;
        if (!optionId) {
          return fail(400, "bad_request", "Option ID is required");
        }

        let result;
        let status;
        try {
          const res = await merchantApi(
            `/products/${encodeURIComponent(productId)}/options/${encodeURIComponent(optionId)}`,
            {
              method: "PUT",
              body: optionData,
            },
          );
          status = res.status;
          result = res.body;
        } catch {
          const res = await merchantApi(
            `/products/options/${encodeURIComponent(optionId)}`,
            {
              method: "PUT",
              body: optionData,
            },
          );
          status = res.status;
          result = res.body;
        }

        if (!result?.success) {
          return fail(
            status >= 400 ? status : 422,
            "salla_api_error",
            result?.error?.message || `Failed to update option`,
          );
        }

        return Response.json({
          success: true,
          option: result.data,
          message: "Option updated successfully",
        });
      }

      case "option_delete": {
        const productId = body.productId;
        const optionId = body.optionId;
        if (!optionId) {
          return fail(400, "bad_request", "Option ID is required");
        }

        let result;
        let status;
        try {
          const res = await merchantApi(
            `/products/${encodeURIComponent(productId)}/options/${encodeURIComponent(optionId)}`,
            { method: "DELETE" },
          );
          status = res.status;
          result = res.body;
        } catch {
          const res = await merchantApi(
            `/products/options/${encodeURIComponent(optionId)}`,
            { method: "DELETE" },
          );
          status = res.status;
          result = res.body;
        }

        if (!result?.success) {
          return fail(
            status >= 400 ? status : 422,
            "salla_api_error",
            result?.error?.message || `Failed to delete option`,
          );
        }

        return Response.json({
          success: true,
          optionId,
          message: "Option deleted successfully",
        });
      }

      // -----------------------------------------------------------------------
      // VARIANTS MANAGEMENT (GET, UPDATE)
      // -----------------------------------------------------------------------
      case "variants_list": {
        const productId = body.productId;
        if (!productId) {
          return fail(400, "bad_request", "Product ID is required");
        }

        let variants = [];
        try {
          const res = await merchantApi(
            `/products/${encodeURIComponent(productId)}/variants`,
          );
          if (res.body?.success && Array.isArray(res.body?.data)) {
            variants = res.body.data;
          }
        } catch {
          try {
            const pRes = await merchantApi(
              `/products/${encodeURIComponent(productId)}`,
            );
            variants =
              pRes.body?.data?.skus || pRes.body?.data?.variants || [];
          } catch {
            variants = [];
          }
        }

        return Response.json({ success: true, variants });
      }

      case "variant_update": {
        const productId = body.productId;
        const variantId = body.variantId;
        const variantData = body.variantData;

        if (!variantId) {
          return fail(400, "bad_request", "Variant ID is required");
        }
        if (!variantData || typeof variantData !== "object") {
          return fail(400, "bad_request", "Variant data is required");
        }

        const payload = {};
        if (variantData.sku !== undefined) payload.sku = String(variantData.sku);
        if (variantData.price !== undefined && variantData.price !== "") {
          payload.price = Number(variantData.price);
        }
        if (variantData.sale_price !== undefined) {
          payload.sale_price =
            variantData.sale_price === null ? null : Number(variantData.sale_price);
        }
        if (variantData.cost_price !== undefined && variantData.cost_price !== "") {
          payload.cost_price = Number(variantData.cost_price);
        }
        if (variantData.quantity !== undefined && variantData.quantity !== "") {
          payload.quantity = Number(variantData.quantity);
        }
        if (variantData.stock_quantity !== undefined && variantData.stock_quantity !== "") {
          payload.stock_quantity = Number(variantData.stock_quantity);
        }
        if (variantData.gtin !== undefined) payload.gtin = String(variantData.gtin);
        if (variantData.barcode !== undefined) payload.barcode = String(variantData.barcode);
        if (variantData.mpn !== undefined) payload.mpn = String(variantData.mpn);
        if (variantData.weight !== undefined && variantData.weight !== "") {
          payload.weight = Number(variantData.weight);
        }

        let result;
        let status;
        try {
          const res = await merchantApi(
            `/products/variants/${encodeURIComponent(variantId)}`,
            {
              method: "PUT",
              body: payload,
            },
          );
          status = res.status;
          result = res.body;
        } catch {
          if (productId) {
            const res = await merchantApi(
              `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
              {
                method: "PUT",
                body: payload,
              },
            );
            status = res.status;
            result = res.body;
          }
        }

        if (!result?.success) {
          return fail(
            status >= 400 ? status : 422,
            "salla_api_error",
            result?.error?.message || `Failed to update variant`,
            result?.error?.fields,
          );
        }

        return Response.json({
          success: true,
          variant: result.data,
          message: "Variant updated successfully",
        });
      }

      // -----------------------------------------------------------------------
      // PRODUCT IMAGES MANAGEMENT (LIST, UPLOAD, DELETE)
      // -----------------------------------------------------------------------
      case "images_list": {
        const productId = body.productId;
        if (!productId) {
          return fail(400, "bad_request", "Product ID is required");
        }

        let images = [];
        try {
          const res = await merchantApi(
            `/products/${encodeURIComponent(productId)}/images`,
          );
          if (res.body?.success && Array.isArray(res.body?.data)) {
            images = res.body.data;
          }
        } catch {
          try {
            const pRes = await merchantApi(
              `/products/${encodeURIComponent(productId)}`,
            );
            images = pRes.body?.data?.images || [];
          } catch {
            images = [];
          }
        }

        return Response.json({ success: true, images });
      }

      case "image_upload": {
        const productId = body.productId;
        const imageData = body.imageData;
        if (!productId) {
          return fail(400, "bad_request", "Product ID is required");
        }
        if (!imageData || (!imageData.original && !imageData.url)) {
          return fail(400, "bad_request", "Image URL or original is required");
        }

        const imgPayload = {
          original: imageData.original || imageData.url,
          default: Boolean(imageData.default),
          sort: imageData.sort || 1,
          alt: imageData.alt || "",
        };

        let result;
        let status;
        try {
          const res = await merchantApi(
            `/products/${encodeURIComponent(productId)}/images`,
            {
              method: "POST",
              body: imgPayload,
            },
          );
          status = res.status;
          result = res.body;
        } catch {
          // Fallback: fetch current images and append via product update
          const pRes = await merchantApi(
            `/products/${encodeURIComponent(productId)}`,
          );
          const currentImages = pRes.body?.data?.images || [];
          const updatedImages = [...currentImages, imgPayload];
          const updateRes = await merchantApi(
            `/products/${encodeURIComponent(productId)}`,
            {
              method: "PUT",
              body: { images: updatedImages },
            },
          );
          status = updateRes.status;
          result = updateRes.body;
        }

        if (!result?.success) {
          return fail(
            status >= 400 ? status : 422,
            "salla_api_error",
            result?.error?.message || "Failed to upload image",
          );
        }

        return Response.json({
          success: true,
          image: result.data,
          message: "Image added successfully",
        });
      }

      case "image_delete": {
        const productId = body.productId;
        const imageId = body.imageId;
        if (!productId || !imageId) {
          return fail(400, "bad_request", "Product ID and Image ID are required");
        }

        let result;
        let status;
        try {
          const res = await merchantApi(
            `/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`,
            { method: "DELETE" },
          );
          status = res.status;
          result = res.body;
        } catch {
          // Fallback: filter out image by id via product update
          const pRes = await merchantApi(
            `/products/${encodeURIComponent(productId)}`,
          );
          const currentImages = pRes.body?.data?.images || [];
          const updatedImages = currentImages.filter(
            (img) => String(img.id) !== String(imageId),
          );
          const updateRes = await merchantApi(
            `/products/${encodeURIComponent(productId)}`,
            {
              method: "PUT",
              body: { images: updatedImages },
            },
          );
          status = updateRes.status;
          result = updateRes.body;
        }

        if (!result?.success) {
          return fail(
            status >= 400 ? status : 422,
            "salla_api_error",
            result?.error?.message || "Failed to delete image",
          );
        }

        return Response.json({
          success: true,
          imageId,
          message: "Image deleted successfully",
        });
      }

      // -----------------------------------------------------------------------
      // BULK PRICE & DISCOUNT UPDATE (POST /admin/v2/products/prices/bulkPrice)
      // -----------------------------------------------------------------------
      case "bulk_price":
      case "bulk_discount": {
        const productsList = body.products;
        if (!Array.isArray(productsList) || productsList.length === 0) {
          return fail(400, "bad_request", "Products array is required");
        }

        // Clean & validate payload
        const cleanProducts = productsList.map((item) => {
          const entry = {
            id: Number(item.id),
            price: Number(item.price),
          };
          if (item.sale_price !== undefined) {
            entry.sale_price =
              item.sale_price === null ? null : Number(item.sale_price);
          }
          if (item.cost_price !== undefined && item.cost_price !== null) {
            entry.cost_price = Number(item.cost_price);
          }
          if (item.sale_end !== undefined) {
            entry.sale_end = item.sale_end || null;
          }
          return entry;
        });

        // Salla bulkPrice supports array of products.
        // Chunk into batches of 100 to avoid payload size limits or gateway timeouts.
        const BATCH_SIZE = 100;
        let totalUpdated = 0;
        let lastMessage = "";

        for (let i = 0; i < cleanProducts.length; i += BATCH_SIZE) {
          const batch = cleanProducts.slice(i, i + BATCH_SIZE);
          const { status, body: result } = await merchantApi(
            "/products/prices/bulkPrice",
            {
              method: "POST",
              body: { products: batch },
            },
          );

          if (!result.success) {
            return fail(
              status >= 400 ? status : 502,
              "salla_api_error",
              result.error?.message ||
                `Failed to update bulk prices (status ${status})`,
              result.error?.fields,
            );
          }

          totalUpdated += batch.length;
          lastMessage = result.data?.message || lastMessage;
        }

        return Response.json({
          success: true,
          count: totalUpdated,
          message:
            lastMessage ||
            `Successfully processed ${totalUpdated} product prices`,
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
