import { formatMetricValue } from "./thresholds.js";

const STORAGE_KEY = "salla_perf_history_v1";
const MAX_STORED_SCANS = 150;

/**
 * Safe localStorage getter
 */
function getRawStorage() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const item = window.localStorage.getItem(STORAGE_KEY);
    return item ? JSON.parse(item) : [];
  } catch (err) {
    console.warn("Failed to read performance history from localStorage:", err);
    return [];
  }
}

/**
 * Safe localStorage setter
 */
function setRawStorage(items) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items.slice(-MAX_STORED_SCANS)),
    );
  } catch (err) {
    console.warn("Failed to save performance history to localStorage:", err);
  }
}

/**
 * Saves a completed PerformanceReport into history storage for both mobile & desktop
 * @param {object} report - Standardized PerformanceReport
 * @param {string} [storeId='default']
 * @returns {Array<object>} The newly saved scan records
 */
export function saveScanToHistory(report, storeId = "default") {
  if (!report || !report.url) return [];

  const now = report.fetchedAt || new Date().toISOString();
  const existing = getRawStorage();
  const newRecords = [];

  ["mobile", "desktop"].forEach((strategy) => {
    const dev = report[strategy];
    if (!dev) return;

    const record = {
      id: `scan_${Date.now()}_${strategy}_${Math.random().toString(36).substring(2, 7)}`,
      storeId: String(storeId),
      url: report.url,
      strategy,
      performanceScore: dev.score,
      lcp: dev.metrics?.lcp?.value ?? null,
      inp: dev.metrics?.inp?.value ?? null,
      cls: dev.metrics?.cls?.value ?? null,
      fcp: dev.metrics?.fcp?.value ?? null,
      ttfb: dev.metrics?.ttfb?.value ?? null,
      createdAt: now,
    };

    newRecords.push(record);
    existing.push(record);
  });

  setRawStorage(existing);
  return newRecords;
}

/**
 * Retrieves scan history filtered by URL, strategy, and time range
 * @param {object} filter
 * @param {string} [filter.url]
 * @param {string} [filter.strategy='mobile'] - 'mobile' | 'desktop'
 * @param {number} [filter.days=30] - 7, 30, or 90
 * @returns {Array<object>} List of scan records sorted by createdAt ASC
 */
export function getScanHistory({ url, strategy = "mobile", days = 30 } = {}) {
  const all = getRawStorage();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return all
    .filter((item) => {
      if (strategy && item.strategy !== strategy) return false;
      if (url && item.url.replace(/\/$/, "") !== url.replace(/\/$/, ""))
        return false;
      const itemTime = new Date(item.createdAt).getTime();
      return itemTime >= cutoff;
    })
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
}

/**
 * Gets the most recent scan before the current one to allow comparison
 * @param {string} url
 * @param {string} strategy
 * @param {string} [currentScanTime]
 * @returns {object|null}
 */
export function getPreviousScan(url, strategy, currentScanTime) {
  const all = getRawStorage();
  const curTime = currentScanTime
    ? new Date(currentScanTime).getTime()
    : Date.now();

  const matching = all
    .filter((item) => {
      if (item.strategy !== strategy) return false;
      if (url && item.url.replace(/\/$/, "") !== url.replace(/\/$/, ""))
        return false;
      return new Date(item.createdAt).getTime() < curTime;
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  return matching[0] || null;
}

/**
 * Compares two scan records and strictly evaluates improvement direction
 * For Score: higher is better (positive delta = improvement)
 * For LCP, INP, CLS, FCP, TTFB: lower is better (negative delta = improvement)
 *
 * @param {object} current - Current scan (or device performance object)
 * @param {object} previous - Previous scan record
 * @returns {object|null} Comparison breakdown
 */
export function compareScans(current, previous) {
  if (!current || !previous) return null;

  const getVal = (obj, key) => {
    if (!obj) return null;
    if (obj.metrics && obj.metrics[key]) {
      return obj.metrics[key].value;
    }
    return obj[key] ?? null;
  };

  const getScore = (obj) => {
    if (!obj) return null;
    return typeof obj.score === "number"
      ? obj.score
      : (obj.performanceScore ?? null);
  };

  const compareMetric = (key, isHigherBetter = false) => {
    const curVal = getVal(current, key);
    const prevVal = getVal(previous, key);

    if (curVal === null || prevVal === null) {
      return {
        key,
        current: curVal,
        previous: prevVal,
        delta: null,
        status: "no-data",
        label: "No comparison data",
      };
    }

    const delta = curVal - prevVal;
    const isZero = Math.abs(delta) < (key === "cls" ? 0.005 : 5);

    let status = "unchanged";
    if (!isZero) {
      if (isHigherBetter) {
        status = delta > 0 ? "improved" : "regressed";
      } else {
        status = delta < 0 ? "improved" : "regressed";
      }
    }

    const formattedCur = formatMetricValue(key, curVal);
    const formattedPrev = formatMetricValue(key, prevVal);
    const absDelta = Math.abs(delta);
    const formattedDelta = formatMetricValue(key, absDelta);

    let label = "Unchanged";
    if (status === "improved") {
      label = `${isHigherBetter ? "↑" : "↓"} ${formattedDelta} improvement`;
    } else if (status === "regressed") {
      label = `${isHigherBetter ? "↓" : "↑"} ${formattedDelta} regression`;
    }

    return {
      key,
      current: curVal,
      previous: prevVal,
      delta,
      formattedCur,
      formattedPrev,
      formattedDelta,
      status,
      label,
    };
  };

  // Compare score (higher is better)
  const curScore = getScore(current);
  const prevScore = getScore(previous);
  let scoreDiff = null;

  if (curScore !== null && prevScore !== null) {
    const delta = curScore - prevScore;
    const status =
      delta > 0 ? "improved" : delta < 0 ? "regressed" : "unchanged";
    scoreDiff = {
      current: curScore,
      previous: prevScore,
      delta,
      status,
      label:
        delta > 0 ? `+${delta} pts` : delta < 0 ? `${delta} pts` : "No change",
    };
  }

  return {
    score: scoreDiff,
    lcp: compareMetric("lcp", false),
    inp: compareMetric("inp", false),
    cls: compareMetric("cls", false),
    fcp: compareMetric("fcp", false),
    ttfb: compareMetric("ttfb", false),
    previousTestedAt: previous.createdAt,
  };
}

/**
 * Clears stored history (useful for tests or user reset)
 */
export function clearPerformanceHistory() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    // Ignore
  }
}
