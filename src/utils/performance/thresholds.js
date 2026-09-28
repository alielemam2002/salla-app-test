/**
 * Official Google Web Vitals & Lighthouse Thresholds
 * Source: https://web.dev/vitals/ & Google PageSpeed documentation
 */

export const METRIC_THRESHOLDS = {
  lcp: {
    id: "lcp",
    name: "Largest Contentful Paint",
    acronym: "LCP",
    unit: "ms",
    good: 2500,
    needsImprovement: 4000,
    lowerIsBetter: true,
    description: "يقيس سرعة تحميل المحتوى الأساسي للصفحة (الصور والعناوين الرئيسية).",
    whyItMatters: "يحتاج المتسوق لرؤية محتوى الصفحة الرئيسي خلال 2.5 ثانية للشعور بالسرعة والاستقرار قبل مغادرة المتجر.",
  },
  inp: {
    id: "inp",
    name: "Interaction to Next Paint",
    acronym: "INP",
    unit: "ms",
    good: 200,
    needsImprovement: 500,
    lowerIsBetter: true,
    description: "يقيس مدى استجابة وتفاعل الصفحة عند نقر الأزرار وتمرير القوائم.",
    whyItMatters: "يضمن سلاسة تفاعل العميل مع السلة، الفلاتر، وخيارات المنتجات بدون تجمّد في واجهة المتجر.",
  },
  cls: {
    id: "cls",
    name: "Cumulative Layout Shift",
    acronym: "CLS",
    unit: "score",
    good: 0.1,
    needsImprovement: 0.25,
    lowerIsBetter: true,
    description: "يقيس الاستقرار البصري ومقدار القفزات والحركات المفاجئة في عناصر الصفحة أثناء التحميل.",
    whyItMatters: "يمنع نقر العميل على أزرار بالخطأ بسبب تحرك المحتوى فجأة قبل اكتمال تحميل البنرات والإعلانات.",
  },
  fcp: {
    id: "fcp",
    name: "First Contentful Paint",
    acronym: "FCP",
    unit: "ms",
    good: 1800,
    needsImprovement: 3000,
    lowerIsBetter: true,
    description: "يقيس الوقت المستغرق لظهور أول نص أو صورة على الشاشة أمام العميل.",
    whyItMatters: "يمنح العميل طمأنينة سريعة بأن المتجر يعمل بنجاح وجارٍ عرض المحتوى.",
  },
  ttfb: {
    id: "ttfb",
    name: "Time to First Byte",
    acronym: "TTFB",
    unit: "ms",
    good: 800,
    needsImprovement: 1800,
    lowerIsBetter: true,
    description: "يقيس سرعة استجابة خادم المتجر (Server Response Time) لاستقبال أول بايت من البيانات.",
    whyItMatters: "تأخر استجابة الخادم يعطل تحميل كافة عناصر المتجر ويزيد من وقت الانتظار.",
  },
};

export const SCORE_THRESHOLDS = {
  good: 90,
  needsImprovement: 50,
};

/**
 * Calculate rating for a specific metric based on its value
 * @param {string} metricId - 'lcp' | 'inp' | 'cls' | 'fcp' | 'ttfb'
 * @param {number} value - numeric value
 * @returns {'good' | 'needs-improvement' | 'poor' | 'unknown'}
 */
export function getMetricRating(metricId, value) {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return "unknown";
  }

  const threshold = METRIC_THRESHOLDS[metricId.toLowerCase()];
  if (!threshold) return "unknown";

  const num = Number(value);

  if (num <= threshold.good) {
    return "good";
  }
  if (num <= threshold.needsImprovement) {
    return "needs-improvement";
  }
  return "poor";
}

/**
 * Calculate rating for overall Performance Score (0-100)
 * @param {number} score
 * @returns {'good' | 'needs-improvement' | 'poor' | 'unknown'}
 */
export function getScoreRating(score) {
  if (score === null || score === undefined || isNaN(Number(score))) {
    return "unknown";
  }
  const num = Number(score);
  if (num >= SCORE_THRESHOLDS.good) return "good";
  if (num >= SCORE_THRESHOLDS.needsImprovement) return "needs-improvement";
  return "poor";
}

/**
 * Format metric value with appropriate unit (e.g. 2400 -> "2.4s", 180 -> "180ms", 0.08 -> "0.08")
 * @param {string} metricId
 * @param {number} value
 * @returns {string}
 */
export function formatMetricValue(metricId, value) {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return "—";
  }

  const id = metricId.toLowerCase();
  const num = Number(value);

  if (id === "cls") {
    return num.toFixed(2);
  }

  if (id === "lcp" || id === "fcp") {
    // If >= 1000ms, format as seconds with 1 decimal
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}s`;
    }
    return `${Math.round(num)}ms`;
  }

  if (id === "ttfb") {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}s`;
    }
    return `${Math.round(num)}ms`;
  }

  // INP or default ms
  return `${Math.round(num)}ms`;
}

/**
 * Human readable label for rating
 * @param {'good' | 'needs-improvement' | 'poor' | 'unknown'} rating
 * @param {string} [locale='ar']
 * @returns {string}
 */
export function getRatingLabel(rating, locale = "ar") {
  if (locale === "ar") {
    switch (rating) {
      case "good":
        return "جيد";
      case "needs-improvement":
        return "يحتاج تحسين";
      case "poor":
        return "ضعيف";
      default:
        return "غير متوفر";
    }
  }

  switch (rating) {
    case "good":
      return "Good";
    case "needs-improvement":
      return "Needs Improvement";
    case "poor":
      return "Poor";
    default:
      return "N/A";
  }
}
