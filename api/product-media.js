/**
 * Vercel Serverless Function - Product media: image upload + AI image studio
 *
 * 1. Upload (multipart/form-data, no `action`): token, appId, productId,
 *    photo, and optional main / sort / alt. This function checks the
 *    embedded session, then forwards the file to:
 *
 *      POST /admin/v2/products/{product}/images   (scope products.read_write)
 *      docs: https://docs.salla.dev/product-images/attach-image.md
 *
 *    Salla allows up to 10 images per product and one image per request. It
 *    doesn't document accepted formats or a size limit, so the only size
 *    check here is Vercel's own request body limit (4.5 MB per request).
 *
 * 2. AI image studio (DeepAI, api/_lib/deepai.js; rules shared with the
 *    browser in src/utils/aiImageStudio.js). Every action checks the
 *    embedded session first; the DeepAI key never leaves the server.
 *    - ai_generate (JSON): { prompt, style, quality } → text2img.
 *    - ai_improve (JSON { tool, imageUrl, text } or multipart with an
 *      `image` file): background-remover / torch-srgan / image-editor.
 *      Both answer { output: { id, url } }: a preview hosted by DeepAI.
 *    - ai_attach (JSON): { productId, url, main, sort, alt }. Downloads the
 *      result (DeepAI hosts only) and attaches it like an uploaded file.
 *
 * Salla has no file upload for videos: videos are YouTube links, added with
 * the "video_attach" action of api/products.js.
 */

import { introspectEmbeddedToken, sallaApiFor } from "./_lib/salla.js";
import {
  deepaiConfigured,
  downloadOutput,
  isDeepAiOutputUrl,
  runDeepAI,
} from "./_lib/deepai.js";
import {
  AI_NEGATIVE_PROMPT,
  AI_PROMPT_MAX,
  DEFAULT_QUALITY,
  DEFAULT_STYLE,
  buildGeneratePrompt,
  findQuality,
  findStyle,
  findTool,
  isHttpsUrl,
} from "../src/utils/aiImageStudio.js";

// Vercel rejects function requests over 4.5 MB (FUNCTION_PAYLOAD_TOO_LARGE).
// Keep the file itself under that with room for the other form fields.
export const MAX_UPLOAD_BYTES = 4_400_000;

const ERROR_STATUS = {
  store_not_authorized: 403,
  token_expired: 401,
  missing_scope: 403,
};

const fail = (status, code, error, fields = null) =>
  Response.json(
    { success: false, status, code, error, ...(fields ? { fields } : {}) },
    { status },
  );

const failFrom = (error, label) => {
  console.error(`${label} failed:`, error.message);
  return fail(
    error.status || ERROR_STATUS[error.code] || 500,
    error.code || "server_error",
    error.message || "حدث خطأ غير متوقع في الخادم.",
  );
};

const text = (form, key) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const str = (value) => (typeof value === "string" ? value.trim() : "");

const isProductId = (value) => /^\d+$/.test(String(value ?? ""));

/** Problem with a picked image file (Arabic), or null when it can be sent. */
function fileProblem(file) {
  if (!file || typeof file === "string") {
    return fail(400, "bad_request", "يرجى اختيار ملف صورة.");
  }
  if (!String(file.type || "").startsWith("image/")) {
    return fail(415, "unsupported_type", "يمكن رفع ملفات الصور فقط.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail(413, "file_too_large", "حجم الملف أكبر من الحد المسموح للرفع.");
  }
  return null;
}

/** Verified merchant id, or a failure Response. */
async function verifiedMerchant(token, appId) {
  const session = await introspectEmbeddedToken(token, appId);
  if (!session.ok) {
    return { failure: fail(session.status, "session_invalid", session.error) };
  }
  return { merchantId: session.data.merchant_id };
}

/** POST /products/{id}/images with this store's own token (Easy Mode). */
async function attachToProduct(merchantId, productId, photo, options) {
  const upstream = new FormData();
  upstream.append("photo", photo, photo.name || "image");
  if (options.main) upstream.append("main", "true");
  if (/^\d+$/.test(options.sort)) upstream.append("sort", options.sort);
  if (options.alt) upstream.append("alt", options.alt.slice(0, 255));

  const { status, body } = await sallaApiFor(merchantId)(
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
}

// ---------------------------------------------------------------------------
// AI image studio
// ---------------------------------------------------------------------------

function generateFields(body) {
  const prompt = str(body.prompt);
  const style = str(body.style) || DEFAULT_STYLE;
  const quality = findQuality(str(body.quality) || DEFAULT_QUALITY);
  if (!prompt) return { failure: fail(400, "bad_request", "اكتب وصف الصورة.") };
  if (prompt.length > AI_PROMPT_MAX) {
    return { failure: fail(400, "bad_request", "وصف الصورة طويل جدًا.") };
  }
  if (!findStyle(style) || !quality) {
    return { failure: fail(400, "bad_request", "نمط أو جودة غير معروفة.") };
  }
  return {
    fields: {
      text: buildGeneratePrompt(prompt, style),
      negative_prompt: AI_NEGATIVE_PROMPT,
      ...quality.fields,
    },
  };
}

/** Tool + image (URL or file) + text → DeepAI fields, or a failure. */
function improveFields({ tool: toolId, image, text: editText }) {
  const tool = findTool(toolId);
  if (!tool)
    return { failure: fail(400, "bad_request", "نوع تحسين غير معروف.") };
  if (typeof image === "string") {
    if (!isHttpsUrl(image)) {
      return {
        failure: fail(400, "invalid_image_url", "رابط الصورة غير صالح."),
      };
    }
  } else {
    const problem = fileProblem(image);
    if (problem) return { failure: problem };
  }
  if (tool.needsText && !editText) {
    return { failure: fail(400, "bad_request", "اكتب التعديل المطلوب.") };
  }
  if (editText.length > AI_PROMPT_MAX) {
    return { failure: fail(400, "bad_request", "وصف التعديل طويل جدًا.") };
  }
  return {
    model: tool.model,
    fields: { image, text: tool.needsText ? editText : undefined },
  };
}

/** Session check, then one DeepAI call → `{ output: { id, url } }`. */
async function runAi(token, appId, model, fields) {
  try {
    const { failure } = await verifiedMerchant(token, appId);
    if (failure) return failure;
    if (!deepaiConfigured()) {
      return fail(
        503,
        "ai_not_configured",
        "خدمة الصور بالذكاء الاصطناعي غير مفعّلة.",
      );
    }
    const output = await runDeepAI(model, fields);
    return Response.json({ success: true, output });
  } catch (error) {
    return failFrom(error, `AI image (${model})`);
  }
}

async function aiAttach(token, appId, body) {
  const productId = String(body.productId ?? "");
  const url = str(body.url);
  if (!isProductId(productId)) {
    return fail(400, "bad_request", "A numeric product ID is required");
  }
  if (!isDeepAiOutputUrl(url)) {
    return fail(400, "invalid_output_url", "رابط الصورة غير مقبول.");
  }
  try {
    const { merchantId, failure } = await verifiedMerchant(token, appId);
    if (failure) return failure;
    const photo = await downloadOutput(url);
    return await attachToProduct(merchantId, productId, photo, {
      main: body.main === true,
      sort: Number.isInteger(body.sort) ? String(body.sort) : "",
      alt: str(body.alt),
    });
  } catch (error) {
    return failFrom(error, "AI image attach");
  }
}

async function handleJson(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "Expected a JSON body");
  }
  if (!body || typeof body !== "object") {
    return fail(400, "bad_request", "Expected a JSON body");
  }

  const token = str(body.token);
  const appId = process.env.SALLA_APP_ID || str(body.appId);
  if (!token) return fail(400, "bad_request", "Token is required");
  if (!appId) return fail(400, "bad_request", "App ID is required");

  switch (body.action) {
    case "ai_generate": {
      const { fields, failure } = generateFields(body);
      return failure || runAi(token, appId, "text2img", fields);
    }
    case "ai_improve": {
      const { model, fields, failure } = improveFields({
        tool: str(body.tool),
        image: str(body.imageUrl),
        text: str(body.text),
      });
      return failure || runAi(token, appId, model, fields);
    }
    case "ai_attach":
      return aiAttach(token, appId, body);
    default:
      return fail(400, "unknown_action", "Unknown action");
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function POST(request) {
  const type = (request.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("multipart/form-data")) return handleJson(request);

  let form;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "bad_request", "Expected a multipart/form-data body");
  }

  const token = text(form, "token");
  const appId = process.env.SALLA_APP_ID || text(form, "appId");
  const action = text(form, "action");

  if (!token) return fail(400, "bad_request", "Token is required");
  if (!appId) return fail(400, "bad_request", "App ID is required");

  // AI improve of a file from the merchant's device.
  if (action === "ai_improve") {
    const { model, fields, failure } = improveFields({
      tool: text(form, "tool"),
      image: form.get("image"),
      text: text(form, "text"),
    });
    return failure || runAi(token, appId, model, fields);
  }
  if (action) return fail(400, "unknown_action", "Unknown action");

  const productId = text(form, "productId");
  const photo = form.get("photo");
  if (!isProductId(productId)) {
    return fail(400, "bad_request", "A numeric product ID is required");
  }
  const problem = fileProblem(photo);
  if (problem) return problem;

  try {
    const { merchantId, failure } = await verifiedMerchant(token, appId);
    if (failure) return failure;
    return await attachToProduct(merchantId, productId, photo, {
      main: text(form, "main") === "true",
      sort: text(form, "sort"),
      alt: text(form, "alt"),
    });
  } catch (error) {
    return failFrom(error, "Product media upload");
  }
}
