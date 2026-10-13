import { PRODUCT_MEDIA_FUNCTION_URL, getAppId } from "./constants.js";

// A single image upload through Vercel + Salla. The function itself is
// limited by Vercel, so give the whole request up to 2 minutes.
const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Upload one image file to a product (api/product-media.js → Salla).
 *
 * Uses XMLHttpRequest because fetch() can't report upload progress.
 * `onProgress(ratio)` gets the real share of bytes sent to our server (0–1);
 * after that Salla still has to store the image. Never throws: resolves to
 * `{ success: true, image }` or `{ success: false, status, code, error }`.
 * Aborting through `signal` resolves with `code: "aborted"`.
 */
export function uploadProductImageFile({
  token,
  productId,
  file,
  main = false,
  sort,
  alt,
  onProgress,
  signal,
}) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ success: false, status: 0, code: "aborted" });
      return;
    }

    const form = new FormData();
    form.append("token", token || "");
    form.append("appId", getAppId() || "");
    form.append("productId", String(productId));
    form.append("photo", file, file.name);
    if (main) form.append("main", "true");
    if (Number.isInteger(sort)) form.append("sort", String(sort));
    if (alt) form.append("alt", alt);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", PRODUCT_MEDIA_FUNCTION_URL);
    xhr.timeout = UPLOAD_TIMEOUT_MS;

    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const finish = (result) => {
      signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.min(1, event.loaded / event.total));
      }
    };
    xhr.onload = () => {
      let json = null;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        // Vercel answers "Request Entity Too Large" as plain text.
      }
      if (json?.success) {
        finish({ success: true, image: json.image });
        return;
      }
      finish({
        success: false,
        status: xhr.status,
        code:
          json?.code ||
          (xhr.status === 413 ? "file_too_large" : "bad_response"),
        error: json?.error || `تعذّر رفع الملف (رمز الحالة ${xhr.status})`,
        fields: json?.fields,
      });
    };
    xhr.onerror = () =>
      finish({ success: false, status: 0, code: "network_error" });
    xhr.ontimeout = () =>
      finish({ success: false, status: 0, code: "timeout" });
    xhr.onabort = () => finish({ success: false, status: 0, code: "aborted" });

    xhr.send(form);
  });
}

// ---------------------------------------------------------------------------
// AI image studio (api/product-media.js → DeepAI). A generation can take up
// to a minute; the function itself stops at 60 s.
// ---------------------------------------------------------------------------

const AI_TIMEOUT_MS = 75_000;

/** POST to the media function. Never throws; same result shape as above. */
async function postMediaAction(body) {
  const isForm = body instanceof FormData;
  try {
    const response = await fetch(PRODUCT_MEDIA_FUNCTION_URL, {
      method: "POST",
      headers: isForm ? undefined : { "Content-Type": "application/json" },
      body: isForm ? body : JSON.stringify(body),
      signal: AbortSignal.timeout?.(AI_TIMEOUT_MS),
    });
    const json = await response.json().catch(() => null);
    if (json?.success) return json;
    return {
      success: false,
      status: response.status,
      code:
        json?.code ||
        (response.status === 504
          ? "deepai_timeout"
          : response.status === 413
            ? "file_too_large"
            : "bad_response"),
      error: json?.error,
      fields: json?.fields,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      code: error?.name === "TimeoutError" ? "timeout" : "network_error",
    };
  }
}

/** Text → new image. Resolves `{ success: true, output: { id, url } }`. */
export function generateAiImage({ token, prompt, style, quality }) {
  return postMediaAction({
    action: "ai_generate",
    token,
    appId: getAppId() || "",
    prompt,
    style,
    quality,
  });
}

/**
 * Improve one image: `imageUrl` (public https link, e.g. a product image)
 * or `file` (from the merchant's device). Same result as generateAiImage.
 */
export function improveAiImage({ token, tool, text, imageUrl, file }) {
  if (file) {
    const form = new FormData();
    form.append("action", "ai_improve");
    form.append("token", token || "");
    form.append("appId", getAppId() || "");
    form.append("tool", tool);
    if (text) form.append("text", text);
    form.append("image", file, file.name);
    return postMediaAction(form);
  }
  return postMediaAction({
    action: "ai_improve",
    token,
    appId: getAppId() || "",
    tool,
    text,
    imageUrl,
  });
}

/** Add a studio result to the product in Salla → `{ success, image }`. */
export function attachAiImage({ token, productId, url, main, sort, alt }) {
  return postMediaAction({
    action: "ai_attach",
    token,
    appId: getAppId() || "",
    productId: String(productId),
    url,
    main: Boolean(main),
    sort: Number.isInteger(sort) ? sort : undefined,
    alt: alt || undefined,
  });
}
