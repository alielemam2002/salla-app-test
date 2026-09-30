/**
 * Vercel Serverless Function - Upload one product image file to Salla
 *
 * The browser sends multipart/form-data (one file per request, the same as
 * Salla): token, appId, productId, photo, and optional main / sort / alt.
 * This function checks the embedded session, then forwards the file to:
 *
 *   POST /admin/v2/products/{product}/images   (scope products.read_write)
 *   docs: https://docs.salla.dev/product-images/attach-image.md
 *
 * Salla allows up to 10 images per product and one image per request. It
 * doesn't document accepted formats or a size limit, so the only size check
 * here is Vercel's own request body limit (4.5 MB per request).
 *
 * Salla has no file upload for videos: videos are YouTube links, added with
 * the "video_attach" action of api/products.js.
 */

import { introspectEmbeddedToken, merchantApi } from "./_lib/salla.js";

// Vercel rejects function requests over 4.5 MB (FUNCTION_PAYLOAD_TOO_LARGE).
// Keep the file itself under that with room for the other form fields.
export const MAX_UPLOAD_BYTES = 4_400_000;

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

const text = (form, key) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

export async function POST(request) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "bad_request", "Expected a multipart/form-data body");
  }

  const token = text(form, "token");
  const appId = process.env.SALLA_APP_ID || text(form, "appId");
  const productId = text(form, "productId");
  const photo = form.get("photo");

  if (!token) return fail(400, "bad_request", "Token is required");
  if (!appId) return fail(400, "bad_request", "App ID is required");
  if (!/^\d+$/.test(productId)) {
    return fail(400, "bad_request", "A numeric product ID is required");
  }
  if (!photo || typeof photo === "string") {
    return fail(400, "bad_request", "يرجى اختيار ملف صورة.");
  }
  if (!String(photo.type || "").startsWith("image/")) {
    return fail(415, "unsupported_type", "يمكن رفع ملفات الصور فقط.");
  }
  if (photo.size > MAX_UPLOAD_BYTES) {
    return fail(413, "file_too_large", "حجم الملف أكبر من الحد المسموح للرفع.");
  }

  try {
    const session = await introspectEmbeddedToken(token, appId);
    if (!session.ok) {
      return fail(session.status, "session_invalid", session.error);
    }

    const upstream = new FormData();
    upstream.append("photo", photo, photo.name || "image");
    if (text(form, "main") === "true") upstream.append("main", "true");
    const sort = text(form, "sort");
    if (/^\d+$/.test(sort)) upstream.append("sort", sort);
    const alt = text(form, "alt");
    if (alt) upstream.append("alt", alt.slice(0, 255));

    const { status, body } = await merchantApi(
      `/products/${encodeURIComponent(productId)}/images`,
      { method: "POST", body: upstream },
    );
    if (!body.success) {
      return fail(
        status >= 400 ? status : 502,
        "salla_api_error",
        body.error?.message || `رفضت سلة الصورة (رمز الحالة ${status})`,
        body.error?.fields || null,
      );
    }
    return Response.json({ success: true, image: body.data }, { status: 201 });
  } catch (error) {
    console.error("Product media upload failed:", error.message);
    return fail(
      error.status || ERROR_STATUS[error.code] || 500,
      error.code || "server_error",
      error.message || "حدث خطأ غير متوقع في الخادم.",
    );
  }
}
