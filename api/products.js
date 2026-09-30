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
 * - images_list: images + YouTube videos from GET /products/{id}
 * - image_delete: DELETE /products/images/{image}
 * - video_attach: POST /products/{id}/video (YouTube links only)
 * - bulk_actions: POST /products/actions (validated by bulkActionSpec.js)
 * Image files are uploaded by api/product-media.js (multipart).
 *
 * Authentication:
 * 1. Verifies the embedded session token via Salla introspect
 * 2. Uses the store's OAuth access token from SALLA_ACCESS_TOKEN
 */

import { introspectEmbeddedToken, merchantApi } from "./_lib/salla.js";
import {
  sanitizeFilters,
  sanitizeOperation,
} from "../src/utils/bulkActions/bulkActionSpec.js";

const MAX_PER_PAGE = 60; // Salla's per_page limit

const YOUTUBE_RE =
  /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{6,}/i;
export const isYoutubeUrl = (url) => YOUTUBE_RE.test(String(url || ""));

// In-memory cache for product metadata like subtitle that might not be echoed in standard Salla GET
const productMetaOverrides = new Map();

const ERROR_STATUS = {
  token_not_configured: 500,
  token_expired: 401,
  missing_scope: 403,
  validation_failed: 422,
};

const fail = (status, code, error, fields = null) => {
  let message = error || "تعذّر تنفيذ العملية";
  if (fields && typeof fields === "object") {
    const details = Object.entries(fields)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .filter(Boolean)
      .join(" | ");
    if (details && !message.includes(details)) {
      message = `${message} (${details})`;
    }
  }
  return Response.json(
    { success: false, code, error: message, ...(fields ? { fields } : {}) },
    { status },
  );
};

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "البيانات المرسلة غير صالحة");
  }

  const { token } = body;
  const appId = process.env.SALLA_APP_ID || body.appId;
  const action = (body.action || "list").toLowerCase();

  if (!token) return fail(400, "bad_request", "رمز الجلسة مطلوب");
  if (!appId) return fail(400, "bad_request", "معرّف التطبيق مطلوب");

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
            result.error?.message || `حدث خطأ من سلة (الحالة ${status})`,
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
          return fail(400, "bad_request", "معرّف المنتج مطلوب");
        }

        const { status, body: result } = await merchantApi(
          `/products/${encodeURIComponent(productId)}`,
        );

        if (!result.success) {
          return fail(
            status >= 400 ? status : 502,
            "salla_api_error",
            result.error?.message || `تعذّر جلب المنتج (الحالة ${status})`,
          );
        }

        const product = result.data ? { ...result.data } : result.data;
        if (product && typeof product === "object") {
          const override = productMetaOverrides.get(String(productId));
          const promo =
            product.promotion_title ||
            product.promotional_title ||
            product.promotion?.title ||
            product.promotion?.name ||
            override?.promotion_title ||
            "";
          if (promo) {
            product.promotion_title = promo;
            product.promotional_title = promo;
          }
          const sub =
            product.subtitle ||
            product.sub_title ||
            product.short_description ||
            product.subTitle ||
            product.metadata?.subtitle ||
            product.metadata?.sub_title ||
            override?.subtitle ||
            "";
          if (sub) {
            product.subtitle = sub;
            product.sub_title = sub;
          }
        }

        return Response.json({
          success: true,
          product,
        });
      }

      // -----------------------------------------------------------------------
      // CREATE PRODUCT
      // -----------------------------------------------------------------------
      case "create": {
        const productData = body.productData;
        if (!productData || typeof productData !== "object") {
          return fail(400, "bad_request", "بيانات المنتج مطلوبة");
        }

        // Validate basic required fields according to Salla OpenAPI specification
        if (!productData.name || !String(productData.name).trim()) {
          return fail(422, "validation_failed", "اسم المنتج مطلوب", {
            name: ["اسم المنتج مطلوب"],
          });
        }
        if (
          productData.price === undefined ||
          productData.price === null ||
          isNaN(Number(productData.price))
        ) {
          return fail(422, "validation_failed", "يرجى إدخال سعر صحيح للمنتج", {
            price: ["يرجى إدخال سعر صحيح للمنتج"],
          });
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
            result.error?.message || `تعذّر إنشاء المنتج (الحالة ${status})`,
            result.error?.fields,
          );
        }

        return Response.json(
          {
            success: true,
            product: result.data,
            message: "تم إنشاء المنتج بنجاح",
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
          return fail(400, "bad_request", "معرّف المنتج مطلوب");
        }
        if (!productData || typeof productData !== "object") {
          return fail(400, "bad_request", "بيانات المنتج مطلوبة");
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
          const maxQ = Number(payload.maximum_quantity_per_order);
          if (!isNaN(maxQ) && maxQ > 0) {
            payload.maximum_quantity_per_order = maxQ;
          } else {
            delete payload.maximum_quantity_per_order;
          }
        } else {
          delete payload.maximum_quantity_per_order;
        }

        if (payload.hide_quantity !== undefined) {
          payload.hide_quantity = Boolean(payload.hide_quantity);
        }

        if (
          payload.sale_price !== undefined &&
          payload.sale_price !== null &&
          payload.sale_price !== "" &&
          !isNaN(Number(payload.sale_price)) &&
          Number(payload.sale_price) > 0
        ) {
          payload.sale_price = Number(payload.sale_price);
          if (!payload.sale_end) {
            delete payload.sale_end;
          }
        } else {
          payload.sale_price = null;
          delete payload.sale_end;
        }
        delete payload.sale_start;

        if (
          payload.cost_price !== undefined &&
          payload.cost_price !== null &&
          payload.cost_price !== ""
        ) {
          payload.cost_price = Number(payload.cost_price);
        } else {
          delete payload.cost_price;
        }

        if (
          payload.weight !== undefined &&
          payload.weight !== null &&
          payload.weight !== ""
        ) {
          payload.weight = Number(payload.weight);
        } else {
          delete payload.weight;
        }

        if (
          payload.brand_id !== undefined &&
          payload.brand_id !== null &&
          payload.brand_id !== "" &&
          !isNaN(Number(payload.brand_id))
        ) {
          payload.brand_id = Number(payload.brand_id);
        } else {
          delete payload.brand_id;
        }

        if (payload.tags !== undefined) {
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
            try {
              const { body: created } = await merchantApi(
                `/products/tags?tag_name=${encodeURIComponent(name)}`,
                { method: "POST" },
              );
              const createdTag = Array.isArray(created.data)
                ? created.data[0]
                : created.data;
              if (created.success && createdTag?.id) {
                tagIds.push(Number(createdTag.id));
              }
            } catch {
              // Ignore tag creation error and continue
            }
          }
          if (tagIds.length > 0) {
            payload.tags = [...new Set(tagIds)];
          } else {
            delete payload.tags;
          }
        }

        for (const strField of [
          "metadata_title",
          "metadata_description",
          "metadata_url",
          "promotion_title",
          "promotional_title",
          "subtitle",
          "sub_title",
          "gtin",
          "mpn",
          "sku",
        ]) {
          if (payload[strField] !== undefined) {
            const val = String(payload[strField] || "").trim();
            if (val) {
              payload[strField] = val;
            } else {
              delete payload[strField];
            }
          }
        }

        if (payload.promotion_title || payload.promotional_title) {
          const promo = String(
            payload.promotion_title || payload.promotional_title,
          ).trim();
          payload.promotion_title = promo;
          payload.promotional_title = promo;
        }
        if (payload.subtitle || payload.sub_title) {
          const sub = String(payload.subtitle || payload.sub_title).trim();
          payload.subtitle = sub;
          payload.sub_title = sub;
        }

        // Remove immutable or read-only fields on update
        delete payload.product_type;
        delete payload.id;
        delete payload.main_image;
        delete payload.thumbnail;

        // Normalize images array if present
        if (Array.isArray(payload.images)) {
          const validImages = payload.images
            .filter((img) => img && (img.original || img.url))
            .map((img, idx) => ({
              ...(img.id ? { id: img.id } : {}),
              original: img.original || img.url,
              default: Boolean(img.default),
              sort: img.sort !== undefined ? Number(img.sort) : idx + 1,
              alt: img.alt || "",
            }));

          if (validImages.length > 0) {
            payload.images = validImages;
          } else {
            delete payload.images;
          }
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
            result.error?.message || `تعذّر تحديث المنتج (الحالة ${status})`,
            result.error?.fields,
          );
        }

        // Salla's PUT response often returns a partial product object that omits
        // fields like promotion_title, subtitle, metadata, etc.
        // Merge the request payload and returned result.data so that saved fields are never lost!
        const mergedProduct = {
          ...payload,
          ...(result.data || {}),
        };
        const finalPromo =
          result.data?.promotion_title ||
          result.data?.promotional_title ||
          result.data?.promotion?.title ||
          payload.promotion_title ||
          "";
        if (finalPromo) {
          mergedProduct.promotion_title = finalPromo;
          mergedProduct.promotional_title = finalPromo;
        }

        const finalSub =
          result.data?.subtitle ||
          result.data?.sub_title ||
          result.data?.short_description ||
          payload.subtitle ||
          "";
        if (finalSub) {
          mergedProduct.subtitle = finalSub;
          mergedProduct.sub_title = finalSub;
        }

        if (finalSub !== undefined) {
          productMetaOverrides.set(String(productId), {
            ...(productMetaOverrides.get(String(productId)) || {}),
            subtitle: finalSub,
            sub_title: finalSub,
            promotion_title: finalPromo,
            promotional_title: finalPromo,
          });
        }

        return Response.json({
          success: true,
          product: mergedProduct,
          message: "تم تحديث المنتج بنجاح",
        });
      }

      // -----------------------------------------------------------------------
      // DELETE PRODUCT
      // -----------------------------------------------------------------------
      case "delete": {
        const productId = body.productId;
        if (!productId) {
          return fail(400, "bad_request", "معرّف المنتج مطلوب");
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
            result.error?.message || `تعذّر حذف المنتج (الحالة ${status})`,
          );
        }

        return Response.json({
          success: true,
          productId,
          message: result.data?.message || "تم حذف المنتج بنجاح",
        });
      }

      // -----------------------------------------------------------------------
      // OPTIONS MANAGEMENT (GET, CREATE, UPDATE, DELETE)
      // -----------------------------------------------------------------------
      case "options_list": {
        const productId = body.productId;
        if (!productId) {
          return fail(400, "bad_request", "معرّف المنتج مطلوب");
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
          return fail(400, "bad_request", "معرّف المنتج مطلوب");
        }
        if (!optionData || typeof optionData !== "object") {
          return fail(400, "bad_request", "بيانات الخيار مطلوبة");
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
            result.error?.message || `تعذّر إنشاء الخيار (الحالة ${status})`,
            result.error?.fields,
          );
        }

        return Response.json({
          success: true,
          option: result.data,
          message: "تم إنشاء الخيار بنجاح",
        });
      }

      case "option_update": {
        const productId = body.productId;
        const optionId = body.optionId;
        const optionData = body.optionData;
        if (!optionId) {
          return fail(400, "bad_request", "معرّف الخيار مطلوب");
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
            result?.error?.message || "تعذّر تحديث الخيار",
          );
        }

        return Response.json({
          success: true,
          option: result.data,
          message: "تم تحديث الخيار بنجاح",
        });
      }

      case "option_delete": {
        const productId = body.productId;
        const optionId = body.optionId;
        if (!optionId) {
          return fail(400, "bad_request", "معرّف الخيار مطلوب");
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
            result?.error?.message || "تعذّر حذف الخيار",
          );
        }

        return Response.json({
          success: true,
          optionId,
          message: "تم حذف الخيار بنجاح",
        });
      }

      // -----------------------------------------------------------------------
      // VARIANTS MANAGEMENT (GET, UPDATE)
      // -----------------------------------------------------------------------
      case "variants_list": {
        const productId = body.productId;
        if (!productId) {
          return fail(400, "bad_request", "معرّف المنتج مطلوب");
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
            variants = pRes.body?.data?.skus || pRes.body?.data?.variants || [];
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
          return fail(400, "bad_request", "معرّف المتغير مطلوب");
        }
        if (!variantData || typeof variantData !== "object") {
          return fail(400, "bad_request", "بيانات المتغير مطلوبة");
        }

        const payload = {};
        if (variantData.sku !== undefined)
          payload.sku = String(variantData.sku);
        if (variantData.price !== undefined && variantData.price !== "") {
          payload.price = Number(variantData.price);
        }
        if (variantData.sale_price !== undefined) {
          payload.sale_price =
            variantData.sale_price === null
              ? null
              : Number(variantData.sale_price);
        }
        if (
          variantData.cost_price !== undefined &&
          variantData.cost_price !== ""
        ) {
          payload.cost_price = Number(variantData.cost_price);
        }
        if (variantData.quantity !== undefined && variantData.quantity !== "") {
          payload.quantity = Number(variantData.quantity);
        }
        if (
          variantData.stock_quantity !== undefined &&
          variantData.stock_quantity !== ""
        ) {
          payload.stock_quantity = Number(variantData.stock_quantity);
        }
        if (variantData.gtin !== undefined)
          payload.gtin = String(variantData.gtin);
        if (variantData.barcode !== undefined)
          payload.barcode = String(variantData.barcode);
        if (variantData.mpn !== undefined)
          payload.mpn = String(variantData.mpn);
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
            result?.error?.message || "تعذّر تحديث المتغير",
            result?.error?.fields,
          );
        }

        return Response.json({
          success: true,
          variant: result.data,
          message: "تم تحديث المتغير بنجاح",
        });
      }

      // -----------------------------------------------------------------------
      // PRODUCT IMAGES MANAGEMENT (LIST, UPLOAD, DELETE)
      // -----------------------------------------------------------------------
      case "images_list": {
        const productId = body.productId;
        if (!productId) {
          return fail(400, "bad_request", "معرّف المنتج مطلوب");
        }

        // Salla has no "list images" endpoint: images (and YouTube videos)
        // come with Product Details, each { id, url, main, alt, video_url,
        // type, sort }. docs: https://docs.salla.dev/product/product-details.md
        const { status, body: result } = await merchantApi(
          `/products/${encodeURIComponent(productId)}`,
        );
        if (!result?.success) {
          return fail(
            status >= 400 ? status : 502,
            "salla_api_error",
            result?.error?.message || "تعذّر تحميل صور المنتج",
          );
        }
        const images = Array.isArray(result.data?.images)
          ? result.data.images
          : [];

        return Response.json({ success: true, images });
      }

      case "image_upload": {
        const productId = body.productId;
        const imageData = body.imageData;
        if (!productId) {
          return fail(400, "bad_request", "معرّف المنتج مطلوب");
        }
        if (!imageData || (!imageData.original && !imageData.url)) {
          return fail(400, "bad_request", "رابط الصورة مطلوب");
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
            result?.error?.message || "تعذّر رفع الصورة",
          );
        }

        return Response.json({
          success: true,
          image: result.data,
          message: "تمت إضافة الصورة بنجاح",
        });
      }

      case "image_delete": {
        const productId = body.productId;
        const imageId = body.imageId;
        if (!productId || !imageId) {
          return fail(400, "bad_request", "معرّف المنتج ومعرّف الصورة مطلوبان");
        }

        // DELETE /products/images/{image} (the image id alone identifies it).
        // docs: https://docs.salla.dev/product-images/delete-image.md
        const { status, body: result } = await merchantApi(
          `/products/images/${encodeURIComponent(imageId)}`,
          { method: "DELETE" },
        );

        if (!result?.success) {
          return fail(
            status >= 400 ? status : 422,
            "salla_api_error",
            result?.error?.message || "تعذّر حذف الصورة",
          );
        }

        return Response.json({
          success: true,
          imageId,
          message: "تم حذف الصورة بنجاح",
        });
      }

      case "bulk_actions": {
        // POST /products/actions. One product is applied at once; several are
        // queued by Salla, which answers with operation ids (status
        // "in_progress"). docs: https://docs.salla.dev/product/bulk-product-options.md
        const rawOperations = Array.isArray(body.operations)
          ? body.operations
          : [];
        if (!rawOperations.length) {
          return fail(400, "bad_request", "يلزم إجراء واحد على الأقل");
        }
        const operations = [];
        for (const op of rawOperations) {
          const { operation, error } = sanitizeOperation(op);
          if (error) return fail(422, "validation_failed", error);
          operations.push(operation);
        }
        const { filters, error: filterError } = sanitizeFilters(body.filters);
        if (filterError) return fail(422, "validation_failed", filterError);

        const { status, body: result } = await merchantApi(
          "/products/actions",
          { method: "POST", body: { operations, filters } },
        );
        if (!result?.success) {
          return fail(
            status >= 400 ? status : 502,
            "salla_api_error",
            result?.error?.message || "رفضت سلة الإجراء الجماعي",
            result?.error?.fields || null,
          );
        }
        return Response.json({
          success: true,
          operations: Array.isArray(result.data) ? result.data : [],
        });
      }

      case "video_attach": {
        // Salla only takes product videos as YouTube links, one per request.
        // docs: https://docs.salla.dev/product-images/attach-youtube-video.md
        const productId = body.productId;
        const videoUrl = String(body.videoUrl || "").trim();
        if (!productId) {
          return fail(400, "bad_request", "معرّف المنتج مطلوب");
        }
        if (!isYoutubeUrl(videoUrl)) {
          return fail(422, "validation_failed", "رابط يوتيوب مطلوب", {
            video_url: ["استخدم رابط فيديو من يوتيوب"],
          });
        }
        const payload = { video_url: videoUrl };
        if (body.alt) payload.alt = String(body.alt).slice(0, 255);

        const { status, body: result } = await merchantApi(
          `/products/${encodeURIComponent(productId)}/video`,
          { method: "POST", body: payload },
        );
        if (!result?.success) {
          return fail(
            status >= 400 ? status : 422,
            "salla_api_error",
            result?.error?.message || "تعذّرت إضافة الفيديو",
            result?.error?.fields || null,
          );
        }
        return Response.json({ success: true, video: result.data });
      }

      // -----------------------------------------------------------------------
      // BULK PRICE & DISCOUNT UPDATE (POST /admin/v2/products/prices/bulkPrice)
      // -----------------------------------------------------------------------
      case "bulk_price":
      case "bulk_discount": {
        const productsList = body.products;
        if (!Array.isArray(productsList) || productsList.length === 0) {
          return fail(400, "bad_request", "قائمة المنتجات مطلوبة");
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
                `تعذّر تحديث الأسعار جماعيًا (الحالة ${status})`,
              result.error?.fields,
            );
          }

          totalUpdated += batch.length;
          lastMessage = result.data?.message || lastMessage;
        }

        return Response.json({
          success: true,
          count: totalUpdated,
          message: lastMessage || `تمت معالجة أسعار ${totalUpdated} منتج بنجاح`,
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

        // GET /products/tags → [{ id, name }] (bulk "features" takes tag ids)
        let tags = [];
        try {
          const tagRes = await merchantApi("/products/tags");
          if (tagRes.body?.success && Array.isArray(tagRes.body?.data)) {
            tags = tagRes.body.data;
          }
        } catch (tagErr) {
          console.warn("Could not load tags:", tagErr.message);
        }

        return Response.json({
          success: true,
          categories,
          brands,
          tags,
        });
      }

      default:
        return fail(400, "bad_request", `إجراء غير معروف: "${action}"`);
    }
  } catch (error) {
    console.error("Products endpoint failed:", error);
    return fail(
      error.status || ERROR_STATUS[error.code] || 500,
      error.code || "server_error",
      error.message || "حدث خطأ داخلي في الخادم",
      error.details?.error?.fields || null,
    );
  }
}
