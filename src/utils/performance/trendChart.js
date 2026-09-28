import { formatMetricValue } from "./thresholds.js";

/** Metrics selectable in the history chart. */
export const TREND_METRICS = {
  performanceScore: {
    label: "Performance Score",
    format: (v) => `${v} نقطة`,
  },
  lcp: {
    label: "LCP (أكبر محتوى)",
    format: (v) => formatMetricValue("lcp", v),
  },
  inp: {
    label: "INP (تفاعل المستخدم)",
    format: (v) => formatMetricValue("inp", v),
  },
  cls: {
    label: "CLS (استقرار العناصر)",
    format: (v) => formatMetricValue("cls", v),
  },
};

export const TREND_RANGES = [7, 30, 90];

export const CHART_SIZE = {
  width: 600,
  height: 220,
  padding: { top: 25, right: 30, bottom: 40, left: 50 },
};

/** Keep history entries that have a numeric value for `metric`. */
export function pickTrendPoints(history, metric) {
  return (history || [])
    .filter((item) => {
      const val = item[metric];
      return val !== null && val !== undefined && !isNaN(Number(val));
    })
    .map((item) => ({ ...item, value: Number(item[metric]) }));
}

/** Y range: scores anchor to 100, other metrics get 15% headroom. */
export function computeYDomain(values, metric) {
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);

  if (metric === "performanceScore") {
    minVal = Math.max(0, Math.floor(minVal / 10) * 10 - 10);
    maxVal = 100;
  } else {
    const pad = (maxVal - minVal) * 0.15 || minVal * 0.1 || 1;
    minVal = Math.max(0, minVal - pad);
    maxVal = maxVal + pad;
  }

  if (maxVal === minVal) maxVal = minVal + 1;
  return { minVal, maxVal };
}

/** Smooth cubic path through the points (horizontal tangents). */
export function buildSmoothPath(coords) {
  return coords
    .map((pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = coords[i - 1];
      const cpX = prev.x + (pt.x - prev.x) / 2;
      return `C ${cpX} ${prev.y}, ${cpX} ${pt.y}, ${pt.x} ${pt.y}`;
    })
    .join(" ");
}

/**
 * Full geometry for the SVG trend chart.
 * Returns point coordinates, line + area paths, Y ticks and which points get
 * an X-axis date label (first, middle, last).
 */
export function buildTrendChart(points, metric, size = CHART_SIZE) {
  const { width, height, padding } = size;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const bottomY = padding.top + innerHeight;

  if (!points || points.length === 0) {
    return { coords: [], pathD: "", areaD: "", yTicks: [] };
  }

  const format = (TREND_METRICS[metric] || TREND_METRICS.performanceScore)
    .format;
  const { minVal, maxVal } = computeYDomain(
    points.map((p) => p.value),
    metric,
  );

  const yTicks = [0, 1, 2, 3].map((i) => {
    const val = minVal + (maxVal - minVal) * (i / 3);
    const y = bottomY - innerHeight * (i / 3);
    return { val, y, label: format(val) };
  });

  const lastIdx = points.length - 1;
  const midIdx = Math.floor(points.length / 2);
  const coords = points.map((p, idx) => {
    const x =
      points.length === 1
        ? padding.left + innerWidth / 2
        : padding.left + (idx / lastIdx) * innerWidth;
    const y = bottomY - ((p.value - minVal) / (maxVal - minVal)) * innerHeight;
    return {
      ...p,
      x,
      y,
      showLabel: idx === 0 || idx === midIdx || idx === lastIdx,
    };
  });

  const pathD = buildSmoothPath(coords);
  const areaD = `${pathD} L ${coords[lastIdx].x} ${bottomY} L ${coords[0].x} ${bottomY} Z`;

  return { coords, pathD, areaD, yTicks };
}
