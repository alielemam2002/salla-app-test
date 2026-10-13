import { describeUploadError } from "./productMedia.js";

/**
 * AI image studio (DeepAI, https://deepai.org/docs): create a product photo
 * from a description, or improve one (remove the background, upscale, edit
 * with a description). Shared by the browser and api/product-media.js, which
 * re-validates every value against these lists. The DeepAI key stays on the
 * server; the browser only sees the result's URL.
 *
 * A result is only a preview on DeepAI. It reaches Salla when the merchant
 * presses "add to product": the server downloads it and attaches it with
 * POST /products/{id}/images, like an uploaded file.
 */

export const AI_PROMPT_MAX = 900;
// Results kept in the studio at once (newest first).
export const AI_RESULTS_MAX = 6;

// Things DeepAI's text2img should avoid in a product photo.
export const AI_NEGATIVE_PROMPT =
  "text, watermark, logo, blurry, distorted, deformed, low quality";

/** Style presets. `prompt` is appended (in English) to the merchant's text. */
export const AI_IMAGE_STYLES = [
  {
    id: "studio",
    label: "تصوير استوديو بخلفية بيضاء",
    prompt:
      "professional e-commerce product photo, studio lighting, plain white background, centered, sharp focus, high detail",
  },
  {
    id: "lifestyle",
    label: "صورة استخدام واقعية",
    prompt:
      "lifestyle product photo in a real everyday setting, natural light, realistic, high detail",
  },
  {
    id: "flatlay",
    label: "تصوير من الأعلى (Flat lay)",
    prompt:
      "flat lay product photo shot from above, minimal styled background, soft shadows, high detail",
  },
  { id: "none", label: "بدون نمط (الوصف فقط)", prompt: "" },
];

/**
 * text2img options. DeepAI: width/height 128–1536 in steps of 32; standard
 * works best around 512, hd around 1024; genius takes a preference instead.
 */
export const AI_IMAGE_QUALITIES = [
  {
    id: "hd",
    label: "عالية الدقة (1024×1024)",
    fields: { image_generator_version: "hd", width: "1024", height: "1024" },
  },
  {
    id: "standard",
    label: "عادية وأسرع (512×512)",
    fields: {
      image_generator_version: "standard",
      width: "512",
      height: "512",
    },
  },
  {
    id: "genius",
    label: "تصوير احترافي (Genius)",
    fields: {
      image_generator_version: "genius",
      genius_preference: "photography",
    },
  },
];

/** Improve tools → DeepAI model. `needsText`: the model requires `text`. */
export const AI_IMAGE_TOOLS = [
  {
    id: "remove_background",
    model: "background-remover",
    label: "إزالة الخلفية",
    hint: "خلفية شفافة (PNG) تُبرز المنتج.",
  },
  {
    id: "upscale",
    model: "torch-srgan",
    label: "رفع الدقة والوضوح",
    hint: "تكبير الصورة وتوضيح تفاصيلها.",
  },
  {
    id: "edit",
    model: "image-editor",
    label: "تعديل بالوصف",
    hint: "اكتب التعديل المطلوب على الصورة.",
    needsText: true,
  },
];

export const DEFAULT_STYLE = "studio";
export const DEFAULT_QUALITY = "hd";
export const DEFAULT_TOOL = "remove_background";

export const findStyle = (id) => AI_IMAGE_STYLES.find((s) => s.id === id);
export const findQuality = (id) => AI_IMAGE_QUALITIES.find((q) => q.id === id);
export const findTool = (id) => AI_IMAGE_TOOLS.find((t) => t.id === id);

/** The text sent to text2img: the merchant's description + the style. */
export function buildGeneratePrompt(text, styleId) {
  const style = findStyle(styleId) || findStyle(DEFAULT_STYLE);
  return [String(text || "").trim(), style.prompt].filter(Boolean).join(", ");
}

/** A public https image link (DeepAI fetches it itself). */
export function isHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const AI_TEXT = {
  open: "صور بالذكاء الاصطناعي",
  title: "استوديو صور المنتج بالذكاء الاصطناعي",
  subtitle:
    "أنشئ صورة جديدة من وصف، أو حسّن صورة موجودة، ثم أضفها لصور المنتج.",
  tabGenerate: "إنشاء صورة",
  tabImprove: "تحسين صورة",
  promptLabel: "وصف الصورة",
  promptPlaceholder: "مثال: white ceramic coffee mug on a wooden table",
  promptHint:
    "الوصف بالإنجليزية يعطي نتيجة أدق. اذكر المنتج ولونه وخامته ومكانه.",
  styleLabel: "النمط",
  qualityLabel: "الجودة",
  generate: "إنشاء الصورة",
  sourceLabel: "الصورة المراد تحسينها",
  sourceEmpty: "لا توجد صور لهذا المنتج بعد. اختر صورة من جهازك.",
  sourceDevice: "صورة من جهازك",
  sourceChange: "تغيير الصورة",
  toolLabel: "نوع التحسين",
  editLabel: "التعديل المطلوب",
  editPlaceholder: "مثال: put the product on a marble table",
  improve: "تحسين الصورة",
  pickSource: "اختر صورة أولًا.",
  working: "يستغرق التنفيذ عادةً من 10 ثوانٍ إلى دقيقة.",
  resultsTitle: "النتائج",
  resultsHint:
    "النتائج معاينة فقط، ولا تُضاف إلى سلة إلا بعد الضغط على «إضافة للمنتج».",
  attach: "إضافة للمنتج",
  attachMain: "إضافة كصورة رئيسية",
  attached: "أُضيفت للمنتج",
  attachedMain: "أُضيفت كصورة رئيسية",
  improveThis: "تحسين هذه الصورة",
  full: "وصل المنتج إلى 10 صور، وهو حد سلة. احذف صورة لإضافة أخرى.",
  close: "إغلاق",
  generatedLabel: (styleLabel) => `صورة جديدة · ${styleLabel}`,
};

/** Server / DeepAI / network failure → short Arabic message. */
export function describeAiImageError(result = {}) {
  switch (result.code) {
    case "ai_not_configured":
      return "خدمة الصور بالذكاء الاصطناعي غير مفعّلة في هذا التطبيق حاليًا.";
    case "deepai_not_pro":
      return "حساب خدمة الصور (DeepAI) يحتاج اشتراك Pro فعّالًا لاستخدام الـ API.";
    case "deepai_unauthorized":
      return "مفتاح خدمة الصور (DeepAI) غير صالح أو نفد رصيده.";
    case "deepai_rate_limited":
      return "طلبات كثيرة لخدمة الصور. انتظر قليلًا ثم حاول مرة أخرى.";
    case "deepai_timeout":
      return "استغرقت خدمة الصور وقتًا أطول من المسموح. حاول مرة أخرى.";
    case "deepai_rejected":
      return "رفضت خدمة الصور الطلب. جرّب وصفًا أو صورة مختلفة.";
    case "deepai_error":
    case "deepai_unreachable":
      return "حدث خطأ في خدمة الصور. حاول مرة أخرى بعد قليل.";
    case "bad_output":
    case "output_unavailable":
      return "لم تعد خدمة الصور بصورة صالحة. أنشئ الصورة من جديد.";
    case "invalid_output_url":
      return "يمكن إضافة الصور الناتجة من الاستوديو فقط.";
    case "invalid_image_url":
      return "رابط الصورة غير صالح. استخدم صورة من المنتج أو من جهازك.";
    default:
      return describeUploadError(result);
  }
}
