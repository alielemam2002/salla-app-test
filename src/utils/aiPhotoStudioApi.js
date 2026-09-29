import { uploadProductImageFile } from "./productMediaApi.js";

export const AI_PHOTO_STUDIO_FUNCTION_URL = "/api/ai-photo-studio";

export const STUDIO_STYLE_PRESETS = [
  {
    id: "marble_studio",
    title: "استوديو رخامي فخم",
    icon: "🏛️",
    badge: "الأكثر طلباً",
    description: "قاعدة رخام أبيض مصقول مع إضاءة ناعمة وظلال نقية.",
  },
  {
    id: "lifestyle_nature",
    title: "بيئة طبيعية عصرية (Lifestyle)",
    icon: "🌿",
    badge: "طبيعي ودافئ",
    description: "أخشاب طبيعية دافئة ولمسات نباتية مبهجة.",
  },
  {
    id: "luxury_gift",
    title: "جلسة إهداء وتغليف راقٍ",
    icon: "🎁",
    badge: "للهدايا والمواسم",
    description: "حرير ساتان ناعم مع علبة هدايا فخمة وشريط أنيق.",
  },
  {
    id: "vibrant_commercial",
    title: "إعلان تجاري عصري (Pop)",
    icon: "🔥",
    badge: "للسوشيال ميديا",
    description: "ألوان متباينة وإضاءة ديناميكية لافتة للنظر.",
  },
];

/**
 * Generate 4 distinct studio photography scenes using Gemini + Flux.
 */
export async function generateStudioPhotos({
  product,
  style = "marble_studio",
  customDetails = "",
  apiKey,
}) {
  const response = await fetch(AI_PHOTO_STUDIO_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product: {
        name: product?.name || "",
        category: product?.category || "",
        brand: product?.brand || "",
        description: product?.description || "",
      },
      style,
      customDetails,
      apiKey,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "تعذر توليد صور الاستوديو للمنتج");
  }

  return data.data;
}

/**
 * Convert an image URL to a File object for multipart upload.
 */
export async function urlToFile(imageUrl, fileName = `studio-${Date.now()}.jpg`) {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`تعذر تنزيل الصورة من الرابط (Status ${res.status})`);
  }
  const blob = await res.blob();
  return new File([blob], fileName, { type: blob.type || "image/jpeg" });
}

/**
 * Upload one studio-generated image directly to Salla's product media gallery.
 */
export async function uploadStudioImageToSalla({
  token,
  productId,
  imageUrl,
  title,
  onProgress,
  signal,
}) {
  if (!imageUrl) {
    return { success: false, error: "رابط الصورة غير صالح" };
  }

  try {
    const fileName = `ai-studio-${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
    const file = await urlToFile(imageUrl, fileName);

    const result = await uploadProductImageFile({
      token,
      productId,
      file,
      alt: title || "صورة استوديو احترافية بالذكاء الاصطناعي",
      onProgress,
      signal,
    });

    return result;
  } catch (err) {
    return {
      success: false,
      error: err.message || "فشل رفع الصورة إلى متجر سلة",
    };
  }
}
