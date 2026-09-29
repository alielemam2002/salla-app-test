export const AI_COPILOT_FUNCTION_URL = "/api/ai-copilot";

/**
 * Calls server-side /api/ai-copilot to generate marketing description,
 * short description, meta title, meta description, and SEO tags via Google Gemini.
 *
 * @param {object} params
 * @param {object} params.product - Product data ({ name, category, price, currency, current_description, brand })
 * @param {string} [params.tone='saudi_commercial'] - 'saudi_commercial' | 'formal_commercial' | 'luxury'
 * @param {string} [params.apiKey] - Optional custom Google Gemini API Key
 * @returns {Promise<object>} Generated content payload
 */
export async function generateAiProductContent({
  product,
  tone = "saudi_commercial",
  apiKey = "",
} = {}) {
  if (!product?.name || typeof product.name !== "string" || !product.name.trim()) {
    throw new Error("اسم المنتج مطلوب لتوليد المحتوى بالذكاء الاصطناعي.");
  }

  const response = await fetch(AI_COPILOT_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product: {
        name: product.name.trim(),
        category: product.category || "",
        price: product.price || "",
        currency: product.currency || "ر.س",
        brand: product.brand || "",
        current_description: product.current_description || product.description || "",
      },
      tone,
      apiKey: apiKey?.trim() || undefined,
    }),
  });

  const data = await response.json().catch(() => ({
    success: false,
    error: `تعذر الاتصال بخدمة الذكاء الاصطناعي (${response.status})`,
  }));

  if (!response.ok || !data.success) {
    throw new Error(
      data.error || "فشل توليد المحتوى بالذكاء الاصطناعي، يرجى المحاولة لاحقاً.",
    );
  }

  return data.data;
}
