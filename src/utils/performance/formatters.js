/**
 * Pure display helpers for the Performance Center UI.
 * Kept free of React so they can be unit tested directly.
 */

/** Arabic device label for a PageSpeed strategy. */
export function getStrategyLabel(strategy) {
  return strategy === "mobile" ? "الجوال" : "الكمبيوتر";
}

/** Map a Web Vitals rating to a Badge tone from the UI kit. */
export function ratingToTone(rating) {
  switch (rating) {
    case "good":
      return "success";
    case "needs-improvement":
      return "warning";
    case "poor":
      return "danger";
    default:
      return "neutral";
  }
}

/** Map a recommendation impact to a Badge tone. */
export function impactToTone(impact) {
  if (impact === "high") return "danger";
  if (impact === "medium") return "warning";
  return "neutral";
}

/** Short impact label used in lists. */
export function getImpactLabel(impact) {
  if (impact === "high") return "أثر كبير";
  if (impact === "medium") return "أثر متوسط";
  return "أثر منخفض";
}

/** Priority label used in the recommendation detail dialog. */
export function getPriorityLabel(impact) {
  if (impact === "high") return "أولوية قصوى";
  if (impact === "medium") return "أولوية متوسطة";
  return "تحسين إضافي";
}

/** "منذ 5 دقيقة" style relative time, falling back to a date after 24h. */
export function formatRelativeTime(isoString, now = Date.now()) {
  if (!isoString) return "";
  try {
    const diffMs = now - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "الآن";
    if (mins === 1) return "منذ دقيقة واحدة";
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    if (hours === 1) return "منذ ساعة واحدة";
    if (hours < 24) return `منذ ${hours} ساعة`;
    return new Date(isoString).toLocaleDateString("ar-SA");
  } catch {
    return "";
  }
}

/** Date + time, e.g. for the previous scan or a chart tooltip. */
export function formatDateTime(isoString) {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleDateString("ar-SA", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Compact day/month label for chart axes. */
export function formatShortDate(isoString) {
  try {
    return new Date(isoString).toLocaleDateString("ar-SA", {
      month: "numeric",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/** CrUX `{ year, month, day }` → "YYYY/M/D", or the fallback text. */
export function formatCruxDate(dateObj, fallback) {
  if (!dateObj) return fallback;
  return `${dateObj.year}/${dateObj.month}/${dateObj.day}`;
}

/** Threshold value with unit, e.g. 2500 → "2.5s", 200 → "200ms". */
export function formatThreshold(key, val) {
  if (val === undefined || val === null) return "";
  if (key === "cls") return val.toFixed(2);
  if (val >= 1000) return `${(val / 1000).toFixed(1)}s`;
  return `${val}ms`;
}

/** Shorten long asset URLs while keeping origin and file name visible. */
export function truncateUrl(url) {
  if (!url) return "";
  if (url.length <= 60) return url;
  try {
    const parsed = new URL(url);
    const path =
      parsed.pathname.length > 30
        ? "..." + parsed.pathname.slice(-25)
        : parsed.pathname;
    return `${parsed.origin}${path}`;
  } catch {
    return url.slice(0, 30) + "..." + url.slice(-25);
  }
}
