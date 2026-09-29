/**
 * Product media rules and the bulk-upload queue (pure, no React).
 *
 * What Salla documents (docs.salla.dev → Product Images):
 * - Attach Image: one image per request, up to 10 images per product.
 * - Videos can only be added as YouTube links (no video file upload).
 * - No accepted formats or size limit are documented. The only size limit
 *   applied here is Vercel's 4.5 MB request limit, because files go through
 *   our serverless function (the access token must stay on the server).
 */

export const MAX_PRODUCT_IMAGES = 10;
// Same value as api/product-media.js (Vercel's 4.5 MB body limit, minus room
// for the other form fields).
export const MAX_UPLOAD_BYTES = 4_400_000;
// Uploads running at once. Each one is an introspect + a Salla call, and
// Salla rate-limits per store (120 requests/minute on the Plus plan).
export const UPLOAD_CONCURRENCY = 2;

export const UPLOAD_STATUS = {
  PENDING: "pending",
  UPLOADING: "uploading",
  UPLOADED: "uploaded",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
  "bmp",
]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "m4v", "avi", "mkv"]);

export const MEDIA_TEXT = {
  sectionTitle: "إدارة الوسائط",
  sectionHint:
    "ارفع عدة صور لهذا المنتج مرة واحدة، أو أضف فيديو من يوتيوب. الملفات ترتبط بهذا المنتج تلقائيًا.",
  dropTitle: "اسحب الصور هنا",
  dropOr: "أو",
  choose: "اختر الملفات",
  dropHint: (max) =>
    `يمكنك اختيار عدة صور في نفس الوقت. حد سلة ${MAX_PRODUCT_IMAGES} صور للمنتج، وحجم الصورة حتى ${max}.`,
  full: "وصل المنتج إلى الحد الأقصى من الصور في سلة (10). احذف صورة لإضافة أخرى.",
  queueTitle: (n) => `الملفات المختارة (${n})`,
  upload: (n) => `رفع ${n} ${n === 1 ? "صورة" : "صور"}`,
  uploading: "جارٍ الرفع…",
  overall: (done, total) => `تم رفع ${done} من ${total}`,
  cancelAll: "إلغاء الكل",
  cancel: "إلغاء",
  remove: "إزالة",
  retry: "إعادة المحاولة",
  retryFailed: "إعادة رفع الفاشلة",
  done: "تم",
  setMain: "اجعلها الصورة الرئيسية",
  mainBadge: "رئيسية",
  summaryTitle: "اكتمل الرفع",
  summaryUploaded: (n) => `✓ ${n} تم رفعها`,
  summaryFailed: (n) => `✕ ${n} فشلت`,
  summaryCancelled: (n) => `${n} أُلغيت`,
  status: {
    pending: "في الانتظار",
    uploading: "جارٍ الرفع",
    processing: "سلة تعالج الصورة…",
    uploaded: "تم الرفع",
    failed: "فشل الرفع",
    cancelled: "أُلغي",
  },
  youtubeLabel: "إضافة فيديو من يوتيوب",
  youtubePlaceholder: "https://www.youtube.com/watch?v=…",
  youtubeAdd: "إضافة الفيديو",
  youtubeHint: "سلة تقبل الفيديوهات كروابط يوتيوب فقط.",
  youtubeInvalid: "أدخل رابط فيديو يوتيوب صحيح.",
};

const ERROR_TEXT = {
  video: "رفع ملفات الفيديو غير مدعوم في واجهة سلة. أضف الفيديو كرابط يوتيوب.",
  notImage: "هذا الملف ليس صورة.",
  mismatch: "امتداد الملف لا يطابق نوعه.",
  tooLarge: (max) => `حجم الملف أكبر من الحد المسموح للرفع (${max}).`,
  empty: "الملف فارغ.",
  limit: `لا يمكن إضافة أكثر من ${MAX_PRODUCT_IMAGES} صور للمنتج في سلة.`,
};

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const extensionOf = (name) => {
  const match = String(name || "").match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
};

/**
 * Check one picked file. Returns null when it can be uploaded, otherwise an
 * Arabic reason. Checks type (MIME + extension) and size.
 */
export function validateMediaFile(file) {
  const type = String(file?.type || "").toLowerCase();
  const ext = extensionOf(file?.name);
  if (type.startsWith("video/") || VIDEO_EXTENSIONS.has(ext)) {
    return ERROR_TEXT.video;
  }
  if (!type.startsWith("image/")) return ERROR_TEXT.notImage;
  // SVG can carry scripts and isn't a product photo.
  if (type === "image/svg+xml" || ext === "svg") return ERROR_TEXT.notImage;
  if (!IMAGE_EXTENSIONS.has(ext)) return ERROR_TEXT.mismatch;
  if (!file.size) return ERROR_TEXT.empty;
  if (file.size > MAX_UPLOAD_BYTES) {
    return ERROR_TEXT.tooLarge(formatBytes(MAX_UPLOAD_BYTES));
  }
  return null;
}

const YOUTUBE_RE =
  /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{6,}/i;
export const isYoutubeUrl = (url) => YOUTUBE_RE.test(String(url || "").trim());

/** Salla / network failure → short Arabic message a merchant can act on. */
export function describeUploadError(result = {}) {
  const { status, code } = result;
  if (code === "aborted") return "أُلغي الرفع.";
  if (code === "timeout") return "انتهت مهلة الرفع. حاول مرة أخرى.";
  if (code === "network_error" || status === 0) {
    return "مشكلة في الاتصال بالإنترنت. حاول مرة أخرى.";
  }
  if (code === "session_invalid") {
    return "انتهت جلسة سلة. حدّث الصفحة ثم حاول مرة أخرى.";
  }
  if (code === "token_not_configured") {
    return "مفتاح الوصول للمتجر (SALLA_ACCESS_TOKEN) غير مضبوط على الخادم.";
  }
  if (code === "missing_scope") {
    return "التطبيق لا يملك صلاحية تعديل المنتجات (products.read_write).";
  }
  switch (status) {
    case 400:
      return "الطلب غير صالح.";
    case 401:
      return "سلة لم تقبل صلاحية التطبيق. قد يكون مفتاح الوصول منتهيًا.";
    case 403:
      return "التطبيق غير مسموح له بتعديل صور المنتج.";
    case 404:
      return "المنتج أو الصورة غير موجودة في سلة.";
    case 413:
      return "حجم الملف أكبر من الحد المسموح.";
    case 415:
      return "نوع الملف غير مدعوم.";
    case 422:
      return result.error && !/^[a-z_.]+$/i.test(result.error)
        ? `سلة رفضت الملف: ${result.error}`
        : "سلة رفضت الملف. تأكد من نوع الصورة وحجمها، ومن أن المنتج لم يصل إلى 10 صور.";
    case 429:
      return "طلبات كثيرة إلى سلة. انتظر دقيقة ثم أعد المحاولة.";
    default:
      if (status >= 500) return "حدث خطأ مؤقت في سلة. حاول لاحقًا.";
      return "تعذر رفع الملف.";
  }
}

// ---------------------------------------------------------------------------
// Upload queue reducer
// ---------------------------------------------------------------------------

let nextId = 0;
const newId = () => `m${Date.now().toString(36)}${(nextId += 1)}`;

export const initialQueueState = { items: [], running: false };

/**
 * Queue item: { id, file, previewUrl, status, progress (0–1 or null),
 * processing, error, main }. `file` and `previewUrl` stay as File / object
 * URL (never base64).
 */
export function queueReducer(state, action) {
  const patch = (id, fields) => ({
    ...state,
    items: state.items.map((it) => (it.id === id ? { ...it, ...fields } : it)),
  });

  switch (action.type) {
    case "add": {
      const added = action.entries.map(({ file, previewUrl, error }) => ({
        id: newId(),
        file,
        previewUrl,
        status: error ? UPLOAD_STATUS.FAILED : UPLOAD_STATUS.PENDING,
        progress: null,
        processing: false,
        error: error || null,
        rejected: Boolean(error),
        main: false,
      }));
      return { ...state, items: [...state.items, ...added] };
    }
    case "remove":
      return {
        ...state,
        items: state.items.filter((it) => it.id !== action.id),
      };
    case "setMain":
      return {
        ...state,
        items: state.items.map((it) => ({
          ...it,
          main: it.id === action.id ? !it.main : false,
        })),
      };
    case "start":
      return { ...state, running: true };
    case "stop":
      return { ...state, running: false };
    case "uploading":
      return patch(action.id, {
        status: UPLOAD_STATUS.UPLOADING,
        progress: null,
        processing: false,
        error: null,
      });
    case "progress":
      return patch(action.id, {
        progress: action.progress,
        processing: action.progress >= 1,
      });
    case "uploaded":
      return patch(action.id, {
        status: UPLOAD_STATUS.UPLOADED,
        progress: 1,
        processing: false,
      });
    case "failed":
      return patch(action.id, {
        status: UPLOAD_STATUS.FAILED,
        processing: false,
        error: action.error,
      });
    case "cancel":
      return {
        ...state,
        items: state.items.map((it) =>
          action.ids.includes(it.id) &&
          (it.status === UPLOAD_STATUS.PENDING ||
            it.status === UPLOAD_STATUS.UPLOADING)
            ? {
                ...it,
                status: UPLOAD_STATUS.CANCELLED,
                processing: false,
                progress: null,
              }
            : it,
        ),
      };
    case "retry":
      return {
        ...state,
        items: state.items.map((it) =>
          action.ids.includes(it.id) &&
          !it.rejected &&
          (it.status === UPLOAD_STATUS.FAILED ||
            it.status === UPLOAD_STATUS.CANCELLED)
            ? {
                ...it,
                status: UPLOAD_STATUS.PENDING,
                error: null,
                progress: null,
              }
            : it,
        ),
      };
    case "clearFinished":
      return {
        ...state,
        items: state.items.filter(
          (it) =>
            it.status === UPLOAD_STATUS.PENDING ||
            it.status === UPLOAD_STATUS.UPLOADING,
        ),
      };
    default:
      return state;
  }
}

/** Counts for the queue header, the overall bar and the summary. */
export function summarizeQueue(items) {
  const count = (status) => items.filter((it) => it.status === status).length;
  const uploadable = items.filter((it) => !it.rejected);
  return {
    total: items.length,
    pending: count(UPLOAD_STATUS.PENDING),
    uploading: count(UPLOAD_STATUS.UPLOADING),
    uploaded: count(UPLOAD_STATUS.UPLOADED),
    failed: count(UPLOAD_STATUS.FAILED),
    retryable: items.filter(
      (it) => it.status === UPLOAD_STATUS.FAILED && !it.rejected,
    ).length,
    cancelled: count(UPLOAD_STATUS.CANCELLED),
    batch: uploadable.length,
  };
}

/**
 * How many more images Salla will take: 10 minus the product's current
 * images (videos don't count) minus the ones already queued or uploading.
 */
export function remainingImageSlots(existingImages, items) {
  const existing = (existingImages || []).filter(
    (img) => (img.type || "image") !== "video",
  ).length;
  const queued = items.filter(
    (it) =>
      it.status === UPLOAD_STATUS.PENDING ||
      it.status === UPLOAD_STATUS.UPLOADING,
  ).length;
  return Math.max(0, MAX_PRODUCT_IMAGES - existing - queued);
}

/** Validate picked files and apply the per-product image limit. */
export function prepareFiles(files, slotsLeft) {
  let slots = slotsLeft;
  return Array.from(files || []).map((file) => {
    let error = validateMediaFile(file);
    if (!error) {
      if (slots <= 0) error = ERROR_TEXT.limit;
      else slots -= 1;
    }
    return { file, error };
  });
}
