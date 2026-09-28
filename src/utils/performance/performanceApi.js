import { PERFORMANCE_FUNCTION_URL } from "../constants.js";
import { normalizePerformanceReport } from "./normalizer.js";
import { saveScanToHistory } from "./historyStorage.js";

/**
 * Calls server-side /api/performance to run Google PageSpeed Insights + CrUX
 * @param {string} url - Target store URL
 * @param {object} [options]
 * @param {string} [options.strategy='all'] - 'mobile' | 'desktop' | 'all'
 * @param {string} [options.apiKey=''] - Optional Google API key
 * @param {boolean} [options.force=false] - Bypass cache
 * @param {object} [options.existingReport=null] - Merge with existing report
 * @param {string} [options.storeId='default']
 * @returns {Promise<object>} Standardized PerformanceReport
 */
export async function runPerformanceTest(
  url,
  {
    strategy = "all",
    apiKey = "",
    force = false,
    existingReport = null,
    storeId = "default",
  } = {},
) {
  const response = await fetch(PERFORMANCE_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "test",
      url,
      strategy,
      apiKey: apiKey || "",
      force: Boolean(force),
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    const error = new Error(
      data.error || "فشل فحص سرعة المتجر، يرجى المحاولة لاحقاً.",
    );
    error.code = data.code || "performance_test_failed";
    error.status = response.status;
    throw error;
  }

  const normalized = normalizePerformanceReport({
    url: data.url,
    mobile: data.mobile,
    desktop: data.desktop,
    cruxMobile: data.cruxMobile,
    cruxDesktop: data.cruxDesktop,
    existingReport,
  });

  // Save to history storage
  try {
    saveScanToHistory(normalized, storeId);
  } catch (err) {
    console.warn("Failed to auto-save scan to history:", err);
  }

  return normalized;
}

/**
 * Attempts to retrieve store default URL from Salla via backend
 * @param {string} token - Embedded Salla session token
 * @param {string} appId - Salla App ID
 * @returns {Promise<string|null>} Store URL or null
 */
export async function fetchStoreDefaultUrl(token, appId) {
  try {
    const response = await fetch(PERFORMANCE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "store_info",
        token,
        appId,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.url || null;
  } catch {
    return null;
  }
}
