/**
 * DeepAI image APIs (https://deepai.org/docs), server only.
 *
 * Every model is one POST to https://api.deepai.org/api/<model> with
 * multipart fields and the key in the `api-key` header. The key is
 * DEEPAI_API_KEY: never sent to the browser, never logged. Success is 200
 * with `{ id, output_url }`; errors are non-200 with `{ err }` or
 * `{ status }`. API access needs a DeepAI Pro subscription: without one every
 * call answers 402 ("APIs are only available for Pro members").
 *
 * Models used (see AI_IMAGE_TOOLS in src/utils/aiImageStudio.js):
 *   text2img            text, width, height, image_generator_version,
 *                       genius_preference, negative_prompt
 *   background-remover  image
 *   torch-srgan         image (super resolution)
 *   image-editor        image, text
 * `image` is a public URL (DeepAI downloads it) or a file.
 */

const DEEPAI_API = "https://api.deepai.org/api";
// vercel.json gives api/product-media.js 60 s. Stop waiting a bit earlier so
// the merchant gets a clear message instead of a killed function.
const DEEPAI_TIMEOUT_MS = 50_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;
// A generated or upscaled photo; this file goes from our server to Salla, so
// Vercel's 4.5 MB request limit doesn't apply here.
export const MAX_OUTPUT_BYTES = 15_000_000;

// DeepAI's own 401/402 must not reach the browser as 401: that status means
// "the Salla session expired" to the app.
const UPSTREAM = {
  401: { status: 502, code: "deepai_unauthorized" },
  402: { status: 502, code: "deepai_not_pro" },
  429: { status: 429, code: "deepai_rate_limited" },
};

function deepaiError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export const deepaiConfigured = () => Boolean(process.env.DEEPAI_API_KEY);

/** Only DeepAI's own result links are downloaded (no open proxy / SSRF). */
export function isDeepAiOutputUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.port &&
      !url.username &&
      !url.password &&
      (url.hostname === "deepai.org" || url.hostname.endsWith(".deepai.org"))
    );
  } catch {
    return false;
  }
}

/**
 * Run one model. `fields` values are strings or a File/Blob (`image`);
 * empty values are left out. Resolves to `{ id, url }`.
 */
export async function runDeepAI(model, fields) {
  const key = process.env.DEEPAI_API_KEY;
  if (!key) {
    throw deepaiError(503, "ai_not_configured", "خدمة الصور غير مفعّلة.");
  }

  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "string") form.append(name, value);
    else form.append(name, value, value.name || "image");
  }

  let response;
  try {
    response = await fetch(`${DEEPAI_API}/${model}`, {
      method: "POST",
      headers: { "api-key": key },
      body: form,
      signal: AbortSignal.timeout(DEEPAI_TIMEOUT_MS),
    });
  } catch (error) {
    if (error?.name === "TimeoutError") {
      throw deepaiError(504, "deepai_timeout", "انتهت مهلة خدمة الصور.");
    }
    throw deepaiError(502, "deepai_unreachable", "تعذّر الاتصال بخدمة الصور.");
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const mapped = UPSTREAM[response.status] || {
      status: response.status >= 500 ? 502 : 422,
      code: response.status >= 500 ? "deepai_error" : "deepai_rejected",
    };
    // DeepAI's reason is English; it is logged, never the request or key.
    console.error(
      `DeepAI ${model} failed (${response.status}):`,
      String(body?.err || body?.status || "").slice(0, 200),
    );
    throw deepaiError(mapped.status, mapped.code, "رفضت خدمة الصور الطلب.");
  }
  if (!isDeepAiOutputUrl(body?.output_url)) {
    throw deepaiError(502, "bad_output", "لم تُرجع خدمة الصور صورة.");
  }
  return { id: body.id ? String(body.id) : null, url: body.output_url };
}

/** Image type from the file's first bytes (the header may be generic). */
export function sniffImageType(bytes) {
  const b = new Uint8Array(bytes.slice(0, 12));
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { type: "image/png", ext: "png" };
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { type: "image/jpeg", ext: "jpg" };
  }
  const ascii = (from, to) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return { type: "image/webp", ext: "webp" };
  }
  return null;
}

/** Download a DeepAI result as a File ready for Salla's Attach Image. */
export async function downloadOutput(url) {
  if (!isDeepAiOutputUrl(url)) {
    throw deepaiError(400, "invalid_output_url", "رابط الصورة غير مقبول.");
  }

  let response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch {
    throw deepaiError(502, "output_unavailable", "تعذّر تنزيل الصورة.");
  }
  if (!response.ok) {
    throw deepaiError(502, "output_unavailable", "الصورة لم تعد متاحة.");
  }
  if (Number(response.headers.get("content-length")) > MAX_OUTPUT_BYTES) {
    throw deepaiError(413, "file_too_large", "حجم الصورة أكبر من المسموح.");
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_OUTPUT_BYTES) {
    throw deepaiError(413, "file_too_large", "حجم الصورة أكبر من المسموح.");
  }
  const kind = bytes.byteLength ? sniffImageType(bytes) : null;
  if (!kind) {
    throw deepaiError(502, "bad_output", "الملف الناتج ليس صورة.");
  }
  return new File([bytes], `ai-image.${kind.ext}`, { type: kind.type });
}
