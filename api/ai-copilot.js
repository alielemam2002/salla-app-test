/**
 * Vercel Serverless Function - AI Product Content & SEO Copilot
 *
 * Uses Google Gemini (gemini-3.5-flash-lite with fallback to gemini-3.5-flash)
 * to generate high-converting e-commerce product descriptions, short descriptions,
 * Meta Titles, Meta Descriptions, and SEO search tags specifically tailored
 * for Saudi and Gulf stores.
 */

const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || "";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const MODELS_PRIORITY = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-flash-latest",
];

const TONE_INSTRUCTIONS = {
  saudi_commercial:
    "لهجة سعودية بيضاء جذابة ومقنعة تمزج بين الحماس واللغة التجارية الراقية القريبة لقلب العميل السعودي والخليجي.",
  formal_commercial:
    "لغة عربية فصحى تجارية احترافية، أنيقة وعصرية، تبرز قيمة المنتج وجودته ومناسبته للجميع.",
  luxury:
    "أسلوب فخم وراقٍ وموجز، يركز على التفرد والهيبة والشعور الحصري بالتميز، ومناسب للهدايا والعطور والمنتجات الفاخرة.",
};

function buildPrompt(product, tone) {
  const toneDesc =
    TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.saudi_commercial;

  return `أنت خبير تسويق تجارة إلكترونية وخبير تحسين محركات بحث (SEO) محترف في منصة سلة والمتاجر السعودية والخليجية.
مهمتك: صياغة محتوى تسويقي احترافي وسيو قوي جداً للمنتج التالي لزيادة المبيعات ومعدل التحويل (Conversion Rate) وظهور المنتج في الصفحة الأولى على Google وبحث متجر سلة الداخلي.

نبرة الصوت والأسلوب: ${toneDesc}

بيانات المنتج:
- اسم المنتج: ${product.name}
- التصنيف: ${product.category || "عام"}
- السعر: ${product.price || ""} ${product.currency || "ر.س"}
${product.brand ? `- الماركة / البراند: ${product.brand}` : ""}
${product.current_description ? `- الوصف الحالي: ${product.current_description}` : ""}

المطلوب: أرجع كائن JSON فقط (Strict JSON Object) بدون أي كود ماركداون خارجي، بالهيكل التالي:
{
  "promotion_title": "عنوان ترويجي جذاب ومختصر جداً (من 2 إلى 4 كلمات) يظهر كشارة أو ملصق بارز فوق بطاقة المنتج بالمتجر لتشجيع العميل على الشراء (مثل: الأكثر مبيعاً 🔥، عرض خاص لفترة محدودة، خصم 30% اليوم، شحن مجاني وسريع، ضمان ذهبي)",
  "subtitle": "عنوان فرعي تسويقي موجز (من 4 إلى 8 كلمات) يظهر أسفل اسم المنتج مباشرة في متجر سلة يلخص الميزة التنافسية أو القيمة الأساسية للمنتج",
  "marketing_description": "وصف تسويقي كامل وجذاب منسق في وسوم HTML نظيفة تشمل: <p>فقرة افتتاحية تشويقية تلامس حاجة العميل</p>، <strong>مميزات المنتج:</strong> <ul><li>ميزة وفائدة واضحة</li><li>ميزة أخرى</li></ul>، و <strong>طريقة الاستخدام أو المواصفات:</strong> <p>تفاصيل عملية ومطمئنة للشراء</p>",
  "short_description": "وصف موجز ومركّز في سطرين يلخص القيمة الأساسية للمنتج بأسلوب حماسي",
  "meta_title": "عنوان سيو جذاب لمحركات البحث Google بين 50 إلى 60 حرفاً يدمج اسم المنتج مع أقوى كلمة بحثية",
  "meta_description": "وصف سيو مقنع لمحركات البحث بين 140 إلى 155 حرفاً يحتوي على فائدة واضحة وعبارة تشجيعية (CTA) للنقر والشراء",
  "tags": ["5 إلى 8 وسوم وكلمات مفتاحية دقيقة تزيد من ظهور المنتج في بحث المتجر الداخلي ومحركات البحث"],
  "seo_slug": "رابط مقترح قصير بالإنجليزية بالأحرف الصغيرة والشرطات فقط (مثل: luxury-white-musk)"
}`;
}

async function callGemini(prompt, apiKey) {
  let lastError = null;

  for (const model of MODELS_PRIORITY) {
    try {
      const endpoint = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error?.message || `HTTP ${response.status}`;
        lastError = new Error(errorMsg);
        // If 503 (high demand) or 429, try next model in priority list
        if (response.status === 503 || response.status === 429) {
          continue;
        }
        throw lastError;
      }

      const candidateText =
        data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        throw new Error("No text content returned from AI model");
      }

      const cleanJson = candidateText
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();

      const parsed = JSON.parse(cleanJson);
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to generate content with AI models");
}

async function handleCopilotRequest(body) {
  const { product, tone = "saudi_commercial", apiKey } = body;

  if (!product || !product.name || typeof product.name !== "string") {
    return {
      status: 400,
      json: { success: false, error: "اسم المنتج مطلوب لتوليد المحتوى." },
    };
  }

  const activeKey =
    (apiKey && typeof apiKey === "string" && apiKey.trim()) ||
    process.env.GEMINI_API_KEY ||
    DEFAULT_GEMINI_KEY;

  if (!activeKey) {
    return {
      status: 400,
      json: {
        success: false,
        error: "يرجى توفير مفتاح Google Gemini API للمتابعة.",
      },
    };
  }

  try {
    const prompt = buildPrompt(product, tone);
    const generated = await callGemini(prompt, activeKey);

    return {
      status: 200,
      json: {
        success: true,
        data: {
          promotion_title: (generated.promotion_title || "").trim(),
          subtitle: (generated.subtitle || generated.short_description || "").trim(),
          short_description: (generated.short_description || generated.subtitle || "").trim(),
          marketing_description: generated.marketing_description || "",
          meta_title: generated.meta_title || "",
          meta_description: generated.meta_description || "",
          tags: Array.isArray(generated.tags) ? generated.tags : [],
          seo_slug: generated.seo_slug || "",
        },
      },
    };
  } catch (error) {
    console.error("AI Copilot generation failed:", error);
    return {
      status: 500,
      json: {
        success: false,
        error: error.message || "تعذر توليد المحتوى بالذكاء الاصطناعي.",
      },
    };
  }
}

// Web API export
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const result = await handleCopilotRequest(body);
  return Response.json(result.json, {
    status: result.status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// Node.js serverless default export
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const result = await handleCopilotRequest(body);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(result.status).json(result.json);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}
