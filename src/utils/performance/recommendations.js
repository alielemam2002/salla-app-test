/**
 * Performance Recommendations Engine
 * Extracts and maps Lighthouse audits into actionable, prioritized recommendations
 * with verified savings and specific metric impact.
 */

export const AUDIT_METRIC_MAP = {
  // Largest Contentful Paint (LCP)
  "render-blocking-resources": {
    metric: "LCP",
    category: "rendering",
    categoryLabel: "موارد تعطل العرض (Rendering)",
    defaultImpact: "high",
    whyItMatters: "الملفات البرمجية (CSS/JS) التي يتم تنزيلها وتفسيرها قبل رسم محتوى المتجر تؤخر ظهور أول عنصر مفيد للعميل.",
    howToFix: [
      "تأجيل تحميل ملفات JavaScript غير الأساسية باستخدام خاصية defer أو async.",
      "تضمين الـ Critical CSS المباشر وتأخير الأنماط الثانوية.",
      "تقليل استدعاء الخطوط والملفات الخارجية الثقيلة في أعلى الصفحة (head).",
    ],
  },
  "uses-responsive-images": {
    metric: "LCP",
    category: "images",
    categoryLabel: "الصور (Images)",
    defaultImpact: "high",
    whyItMatters: "خدمة صور بأبعاد أكبر بكثير من حجم الشاشة الفعلية يستهلك بيانات إضافية ويبطئ عرض صور البنرات والمنتجات.",
    howToFix: [
      "استخدام صور متجاوبة بأبعاد مناسبة لأجهزة الجوال والكمبيوتر (srcset و sizes).",
      "ضغط صور البنرات قبل رفعها لمتجر سلة.",
      "تجنب رفع صور بدقة 4K للمنتجات والواجهات.",
    ],
  },
  "offscreen-images": {
    metric: "LCP",
    category: "images",
    categoryLabel: "الصور (Images)",
    defaultImpact: "medium",
    whyItMatters: "تنزيل الصور الموجودة أسفل الصفحة فور فتح المتجر ينافس تحميل العناصر العلوية التي يراها العميل أولاً.",
    howToFix: [
      "تفعيل خاصية التحميل الكسول (Lazy Loading عبر loading=\"lazy\") لصور المنتجات أسفل الصفحة.",
      "استثناء الصورة الرئيسية الأولى (Hero Image) من الـ Lazy Loading لتظهر فوراً.",
    ],
  },
  "modern-image-formats": {
    metric: "LCP",
    category: "images",
    categoryLabel: "الصور (Images)",
    defaultImpact: "high",
    whyItMatters: "صيغ الصور الحديثة مثل WebP و AVIF توفر ضغطاً متفوقاً بنسبة 30% إلى 50% مقارنة بـ JPEG و PNG دون المساس بالجودة.",
    howToFix: [
      "تحويل صور المنتجات والبنرات إلى صيغة WebP أو AVIF.",
      "الاستفادة من نظام ضغط الصور التلقائي المدمج في منصة سلة.",
    ],
  },
  "uses-optimized-images": {
    metric: "LCP",
    category: "images",
    categoryLabel: "الصور (Images)",
    defaultImpact: "medium",
    whyItMatters: "الصور غير المضغوطة تهدر النطاق الترددي للعميل وتزيد من وقت تنزيل عناصر واجهة المتجر.",
    howToFix: [
      "استخدام أدوات ضغط الصور بدون فقدان جودة (Lossless/Lossy Optimization).",
      "ضبط جودة الصور بين 80% - 85% كحد أقصى للويب.",
    ],
  },
  "server-response-time": {
    metric: "TTFB",
    category: "network",
    categoryLabel: "الشبكة والخادم (Network)",
    defaultImpact: "high",
    whyItMatters: "الوقت المستغرق لاستلام أول رد من الخادم يحدد الحد الأدنى لسرعة استجابة المتجر بالكامل.",
    howToFix: [
      "الاعتماد على شبكة توزيع المحتوى (CDN) للبيانات الثابتة.",
      "تقليل استدعاءات قواعد البيانات والاستعلامات المعقدة في التطبيقات المخصصة.",
      "تفعيل التخزين المؤقت (Page Caching).",
    ],
  },

  // Cumulative Layout Shift (CLS)
  "layout-shift-elements": {
    metric: "CLS",
    category: "layout",
    categoryLabel: "تخطيط الصفحة (Layout)",
    defaultImpact: "high",
    whyItMatters: "تحرك العناصر فجأة أثناء التحميل يربك المتسوق وقد يؤدي لنقرات خاطئة على أزرار الشراء أو الإلغاء.",
    howToFix: [
      "تحديد أبعاد واضحة (width و height أو aspect-ratio) لكل الصور وبنرات السلايدر.",
      "حجز مساحة مسبقة للإعلانات والرسائل الترويجية قبل تحميلها.",
      "تجنب إدخال عناصر ديناميكية جديدة أعلى المحتوى الموجود بالفعل.",
    ],
  },
  "unsized-images": {
    metric: "CLS",
    category: "layout",
    categoryLabel: "تخطيط الصفحة (Layout)",
    defaultImpact: "high",
    whyItMatters: "الصور بدون أبعاد محددة تسبب قفزات ملحوظة في تخطيط الصفحة فور اكتمال تنزيلها.",
    howToFix: [
      "إضافة سمات width و height لجميع علامات <img> في القالب.",
      "استخدام CSS aspect-ratio لحجز المساحة أثناء تنزيل الصورة.",
    ],
  },

  // JavaScript & CSS
  "unused-javascript": {
    metric: "INP",
    category: "javascript",
    categoryLabel: "جافاسكريبت (JavaScript)",
    defaultImpact: "medium",
    whyItMatters: "الأكواد البرمجية الفائضة وغير المستخدمة تستهلك وقت معالج جهاز الجوال وتجعل المتجر بطيئاً في الاستجابة للنقر.",
    howToFix: [
      "حذف السكريبتات الإضافية وتطبيقات الطرف الثالث غير المستخدمة.",
      "تجزئة الأكواد (Code Splitting) وتحميل كل سكريبت فقط في الصفحة المخصصة له.",
    ],
  },
  "unused-css-rules": {
    metric: "FCP",
    category: "css",
    categoryLabel: "تنسيقات CSS",
    defaultImpact: "medium",
    whyItMatters: "ملفات الأنماط الضخمة غير المستخدمة تعطل العرض الأولي للصفحة (FCP).",
    howToFix: [
      "تنظيف ملفات CSS من التنسيقات القديمة وغير المستعملة.",
      "استخراج وتضمين الـ Critical CSS المطلوب للصفحة الحالية فقط.",
    ],
  },
  "unminified-javascript": {
    metric: "FCP",
    category: "javascript",
    categoryLabel: "جافاسكريبت (JavaScript)",
    defaultImpact: "low",
    whyItMatters: "الملفات النصية غير المصغرة تحتوي على مسافات وتعليقات تزيد من حجم التنزيل دون فائدة.",
    howToFix: [
      "تصغير وضغط ملفات JS (Minification via Terser / esbuild).",
      "استخدام حزم الإنتاج المجمعة (Production Bundles).",
    ],
  },
  "unminified-css": {
    metric: "FCP",
    category: "css",
    categoryLabel: "تنسيقات CSS",
    defaultImpact: "low",
    whyItMatters: "عدم تصغير ملفات CSS يستهلك بايتات إضافية أثناء التحميل الأولي.",
    howToFix: [
      "تصغير ملفات CSS باستخدام أدوات مثل cssnano أو clean-css.",
    ],
  },
  "uses-text-compression": {
    metric: "FCP",
    category: "network",
    categoryLabel: "الشبكة والخادم (Network)",
    defaultImpact: "high",
    whyItMatters: "عدم تفعيل ضغط النصوص على الخادم (Gzip أو Brotli) يضاعف حجم الملفات المنقولة عبر الشبكة.",
    howToFix: [
      "التأكد من تفعيل ضغط Brotli أو Gzip للملفات النصية (HTML, CSS, JS, SVG).",
    ],
  },
  "font-display": {
    metric: "FCP",
    category: "fonts",
    categoryLabel: "الخطوط (Fonts)",
    defaultImpact: "medium",
    whyItMatters: "تأخر تنزيل خط المتجر يجعل النصوص مخفية لفترة من الوقت (FOIT)، مما يعيق قراءة المحتوى.",
    howToFix: [
      "استخدام font-display: swap لإظهار خط احتياطي سريعاً ريثما يكتمل تحميل الخط الأصلي.",
      "التحميل المسبق (Preload) للخطوط الأساسية لمتجرك.",
    ],
  },
};

/**
 * Format bytes into human readable string (KB / MB)
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!bytes || isNaN(Number(bytes)) || Number(bytes) <= 0) return "0 KB";
  const num = Number(bytes);
  if (num >= 1024 * 1024) {
    const mb = num / (1024 * 1024);
    return `${parseFloat(mb.toFixed(2))} MB`;
  }
  const kb = num / 1024;
  return `${parseFloat(kb.toFixed(1))} KB`;
}

/**
 * Format milliseconds into human readable string (ms / s)
 * @param {number} ms
 * @returns {string}
 */
export function formatSavingsMs(ms) {
  if (!ms || isNaN(Number(ms)) || Number(ms) <= 0) return null;
  const num = Number(ms);
  if (num >= 1000) {
    return `${parseFloat((num / 1000).toFixed(2))}s`;
  }
  return `${Math.round(num)}ms`;
}

/**
 * Calculate impact level objectively:
 * - High: savings >= 500ms OR bytes >= 1MB OR CLS contribution >= 0.05
 * - Medium: savings >= 100ms OR bytes >= 250KB OR CLS contribution >= 0.01
 * - Low: otherwise
 */
export function calculateImpact(savingsMs, savingsBytes, auditId) {
  const ms = Number(savingsMs) || 0;
  const bytes = Number(savingsBytes) || 0;

  if (ms >= 500 || bytes >= 1024 * 1024) {
    return "high";
  }

  if (auditId === "layout-shift-elements" || auditId === "unsized-images") {
    return "high";
  }

  if (ms >= 100 || bytes >= 250 * 1024) {
    return "medium";
  }

  const meta = AUDIT_METRIC_MAP[auditId];
  return meta?.defaultImpact || "low";
}

/**
 * Extract normalized recommendations from Lighthouse audits object
 * @param {object} audits - Raw lighthouseResult.audits
 * @returns {Array<object>} Sorted list of actionable recommendations
 */
export function extractRecommendations(audits) {
  if (!audits || typeof audits !== "object") return [];

  const list = [];

  for (const [auditId, audit] of Object.entries(audits)) {
    // Only look at audits that have a score < 0.9 or are opportunities/diagnostics with potential savings
    const score = audit.score;
    const isPassing = score !== null && score !== undefined && score >= 0.9;
    if (isPassing) continue;

    const details = audit.details || {};
    const savingsMs = details.overallSavingsMs !== undefined ? details.overallSavingsMs : null;
    const savingsBytes = details.overallSavingsBytes !== undefined ? details.overallSavingsBytes : null;

    // Check if we recognize this audit or if it provides actionable savings
    const meta = AUDIT_METRIC_MAP[auditId];
    const hasRecognizedMeta = Boolean(meta);
    const hasSavings = (savingsMs !== null && savingsMs > 0) || (savingsBytes !== null && savingsBytes > 0);

    if (!hasRecognizedMeta && !hasSavings) {
      continue;
    }

    const impact = calculateImpact(savingsMs, savingsBytes, auditId);

    // Extract items / problematic assets if available
    const items = Array.isArray(details.items)
      ? details.items.slice(0, 10).map((it) => ({
          url: it.url || it.node?.snippet || it.source || "",
          totalBytes: it.totalBytes || it.resourceSize || null,
          wastedBytes: it.wastedBytes || null,
          wastedMs: it.wastedMs || null,
          label: it.node?.nodeLabel || it.label || "",
        }))
      : [];

    list.push({
      id: auditId,
      title: audit.title || auditId,
      description: audit.description || "",
      displayValue: audit.displayValue || null,
      score: audit.score,
      savingsMs,
      savingsBytes,
      formattedSavingsMs: formatSavingsMs(savingsMs),
      formattedSavingsBytes: savingsBytes ? formatBytes(savingsBytes) : null,
      impact,
      metric: meta?.metric || "Performance",
      affectedMetric: meta?.metric || "Performance",
      category: meta?.category || "other",
      categoryLabel: meta?.categoryLabel || "تحسينات عامة",
      whyItMatters: meta?.whyItMatters || "يساهم حل هذه المشكلة في تسريع معالجة المتجر وتحسين تجربة العميل.",
      howToFix: meta?.howToFix || [
        "مراجعة الموارد المستدعاة وتقليل حجم ونطاق البيانات المحملة.",
      ],
      items,
      source: "Google Lighthouse",
    });
  }

  // Sort by priority: High -> Medium -> Low, then by savingsMs descending
  const impactWeight = { high: 3, medium: 2, low: 1 };
  list.sort((a, b) => {
    const diff = (impactWeight[b.impact] || 0) - (impactWeight[a.impact] || 0);
    if (diff !== 0) return diff;
    const bMs = Number(b.savingsMs) || 0;
    const aMs = Number(a.savingsMs) || 0;
    if (bMs !== aMs) return bMs - aMs;
    const bBytes = Number(b.savingsBytes) || 0;
    const aBytes = Number(a.savingsBytes) || 0;
    return bBytes - aBytes;
  });

  return list;
}
