import { METRIC_THRESHOLDS, getMetricRating, getScoreRating, formatMetricValue } from './thresholds.js';
import { extractRecommendations } from './recommendations.js';

/**
 * Normalizes a raw Lighthouse audit into a MetricResult
 * @param {string} id - Metric ID ('lcp', 'cls', etc.)
 * @param {object} audit - Raw Lighthouse audit object
 * @returns {object} Normalized MetricResult
 */
function normalizeLighthouseMetric(id, audit) {
  const threshold = METRIC_THRESHOLDS[id];
  const title = threshold?.name || id.toUpperCase();

  if (!audit) {
    return {
      id,
      title,
      name: threshold?.humanName || title,
      description: threshold?.description || '',
      value: null,
      displayValue: 'N/A',
      rating: 'needs-improvement',
      score: null,
      source: 'lighthouse',
      isLab: true,
      hasData: false
    };
  }

  const rawValue = typeof audit.numericValue === 'number' ? audit.numericValue : null;
  const rating = rawValue !== null ? getMetricRating(id, rawValue) : 'needs-improvement';
  const displayVal = audit.displayValue || (rawValue !== null ? formatMetricValue(id, rawValue) : 'N/A');

  return {
    id,
    title,
    name: threshold?.humanName || title,
    description: threshold?.description || '',
    value: rawValue,
    displayValue: displayVal,
    rating,
    score: typeof audit.score === 'number' ? Math.round(audit.score * 100) : null,
    source: 'lighthouse',
    isLab: true,
    hasData: rawValue !== null
  };
}

/**
 * Normalizes CrUX metric record (from CrUX API or PageSpeed loadingExperience)
 * CrUX returns: { percentile: 2400, distributions: [...], category: 'FAST' | 'AVERAGE' | 'SLOW' }
 * @param {string} id - Metric ID ('lcp', 'inp', etc.)
 * @param {object} metricData - CrUX metric record
 * @returns {object}
 */
export function normalizeCruxMetric(id, metricData) {
  const threshold = METRIC_THRESHOLDS[id];
  const title = threshold?.name || id.toUpperCase();

  if (!metricData || typeof metricData.percentile !== 'number') {
    return {
      id,
      title,
      name: threshold?.humanName || title,
      description: threshold?.description || '',
      value: null,
      displayValue: 'Not enough data',
      rating: 'unknown',
      source: 'crux',
      isLab: false,
      hasData: false
    };
  }

  const value = metricData.percentile;
  const rating = getMetricRating(id, value);
  const displayValue = formatMetricValue(id, value);

  return {
    id,
    title,
    name: threshold?.humanName || title,
    description: threshold?.description || '',
    value,
    displayValue,
    rating,
    category: metricData.category || rating,
    distributions: metricData.distributions || [],
    source: 'crux',
    isLab: false,
    hasData: true
  };
}

/**
 * Extracts CrUX metrics from a CrUX API record or PageSpeed loadingExperience
 * Key map in Google CrUX:
 * LARGEST_CONTENTFUL_PAINT_MS, INTERACTION_TO_NEXT_PAINT, CUMULATIVE_LAYOUT_SHIFT_SCORE,
 * FIRST_CONTENTFUL_PAINT_MS, EXPERIMENTAL_TIME_TO_FIRST_BYTE
 */
export function extractCruxMetrics(cruxSource) {
  if (!cruxSource || !cruxSource.metrics) {
    return {
      hasData: false,
      lcp: normalizeCruxMetric('lcp', null),
      inp: normalizeCruxMetric('inp', null),
      cls: normalizeCruxMetric('cls', null),
      fcp: normalizeCruxMetric('fcp', null),
      ttfb: normalizeCruxMetric('ttfb', null)
    };
  }

  const m = cruxSource.metrics;
  const lcpData = m.LARGEST_CONTENTFUL_PAINT_MS || m.largest_contentful_paint;
  const inpData = m.INTERACTION_TO_NEXT_PAINT || m.interaction_to_next_paint;
  const clsData = m.CUMULATIVE_LAYOUT_SHIFT_SCORE || m.cumulative_layout_shift;
  const fcpData = m.FIRST_CONTENTFUL_PAINT_MS || m.first_contentful_paint;
  const ttfbData = m.EXPERIMENTAL_TIME_TO_FIRST_BYTE || m.experimental_time_to_first_byte || m.FIRST_INPUT_DELAY_MS;

  const hasAnyData = Boolean(
    (lcpData && typeof lcpData.percentile === 'number') ||
    (inpData && typeof inpData.percentile === 'number') ||
    (clsData && typeof clsData.percentile === 'number')
  );

  return {
    hasData: hasAnyData,
    overallCategory: cruxSource.overall_category || null,
    lcp: normalizeCruxMetric('lcp', lcpData),
    inp: normalizeCruxMetric('inp', inpData),
    cls: normalizeCruxMetric('cls', clsData ? {
      // In CrUX, CLS is often given as percentile / 100 or numeric float
      ...clsData,
      percentile: typeof clsData.percentile === 'number' && clsData.percentile > 10 ? clsData.percentile / 100 : clsData.percentile
    } : null),
    fcp: normalizeCruxMetric('fcp', fcpData),
    ttfb: normalizeCruxMetric('ttfb', ttfbData)
  };
}

/**
 * Normalizes single device result (mobile or desktop) from PageSpeed response
 * @param {string} strategy - 'mobile' or 'desktop'
 * @param {object} psiResponse - Raw PageSpeed API response
 * @returns {object} DevicePerformance
 */
export function normalizeDevicePerformance(strategy, psiResponse) {
  if (!psiResponse || !psiResponse.lighthouseResult) {
    return {
      strategy,
      score: null,
      scoreRating: 'unknown',
      testedAt: new Date().toISOString(),
      metrics: {
        lcp: normalizeLighthouseMetric('lcp', null),
        inp: normalizeLighthouseMetric('inp', null),
        cls: normalizeLighthouseMetric('cls', null),
        fcp: normalizeLighthouseMetric('fcp', null),
        ttfb: normalizeLighthouseMetric('ttfb', null),
        tbt: normalizeLighthouseMetric('tbt', null)
      },
      recommendations: [],
      error: psiResponse?.error?.message || 'No lighthouse data returned'
    };
  }

  const lr = psiResponse.lighthouseResult;
  const audits = lr.audits || {};
  const perfCategory = lr.categories?.performance;
  
  // Real Lighthouse Performance Score (0-100)
  const rawScore = typeof perfCategory?.score === 'number' ? Math.round(perfCategory.score * 100) : null;
  const scoreRating = rawScore !== null ? getScoreRating(rawScore) : 'unknown';

  // Lab Metrics from Lighthouse
  const lcp = normalizeLighthouseMetric('lcp', audits['largest-contentful-paint']);
  const cls = normalizeLighthouseMetric('cls', audits['cumulative-layout-shift']);
  const fcp = normalizeLighthouseMetric('fcp', audits['first-contentful-paint']);
  const ttfb = normalizeLighthouseMetric('ttfb', audits['server-response-time']);
  const tbt = normalizeLighthouseMetric('tbt', audits['total-blocking-time']);

  // INP in Lab: Lighthouse uses TBT as a proxy because INP requires user input.
  // We check if experimental INP audit exists, or note lab proxy
  const labInpAudit = audits['interactive-to-next-paint'] || audits['experimental-interaction-to-next-paint'];
  let inp;
  if (labInpAudit && typeof labInpAudit.numericValue === 'number') {
    inp = normalizeLighthouseMetric('inp', labInpAudit);
  } else {
    // Provide a clear explanation that INP is measured in Field/CrUX, not Lab
    inp = {
      id: 'inp',
      title: 'INP',
      name: METRIC_THRESHOLDS.inp.humanName,
      description: METRIC_THRESHOLDS.inp.description,
      value: null,
      displayValue: tbt.hasData ? `TBT proxy: ${tbt.displayValue}` : 'CrUX Field Data Only',
      rating: tbt.hasData ? (tbt.value <= 200 ? 'good' : tbt.value <= 600 ? 'needs-improvement' : 'poor') : 'unknown',
      score: null,
      source: 'lighthouse',
      isLab: true,
      hasData: false,
      note: 'INP requires real user clicks/interactions; see Real User Experience (CrUX) below for actual field INP.'
    };
  }

  const recommendations = extractRecommendations(audits);

  return {
    strategy,
    score: rawScore,
    scoreRating,
    testedAt: lr.fetchTime || new Date().toISOString(),
    benchmarkIndex: lr.environment?.benchmarkIndex,
    userAgent: lr.environment?.hostUserAgent,
    metrics: {
      lcp,
      inp,
      cls,
      fcp,
      ttfb,
      tbt
    },
    recommendations,
    diagnosticsSummary: {
      totalAudits: Object.keys(audits).length,
      passedCount: Object.values(audits).filter(a => a.score === 1).length,
      opportunitiesCount: recommendations.length
    }
  };
}

/**
 * Normalizes full PageSpeed + CrUX results for both Mobile & Desktop into a unified PerformanceReport
 * @param {object} params
 * @param {string} params.url - Tested URL
 * @param {object} params.mobile - Raw Mobile PageSpeed response
 * @param {object} params.desktop - Raw Desktop PageSpeed response
 * @param {object} [params.cruxMobile] - Raw CrUX API response for Mobile (optional)
 * @param {object} [params.cruxDesktop] - Raw CrUX API response for Desktop (optional)
 * @param {object} [params.cruxOrigin] - Raw CrUX API response for Origin (optional)
 * @returns {object} Standardized PerformanceReport
 */
export function normalizePerformanceReport({
  url,
  mobile,
  desktop,
  cruxMobile = null,
  cruxDesktop = null,
  cruxOrigin = null
}) {
  const normalizedMobile = normalizeDevicePerformance('mobile', mobile);
  const normalizedDesktop = normalizeDevicePerformance('desktop', desktop);

  // CrUX Field Data:
  // First try dedicated CrUX responses; fallback to PageSpeed's embedded loadingExperience/originLoadingExperience
  const mobileCruxSource = cruxMobile?.record || mobile?.loadingExperience || mobile?.originLoadingExperience || null;
  const desktopCruxSource = cruxDesktop?.record || desktop?.loadingExperience || desktop?.originLoadingExperience || null;
  const originCruxSource = cruxOrigin?.record || mobile?.originLoadingExperience || desktop?.originLoadingExperience || null;

  const mobileField = extractCruxMetrics(mobileCruxSource);
  const desktopField = extractCruxMetrics(desktopCruxSource);
  const originField = extractCruxMetrics(originCruxSource);

  const hasFieldData = mobileField.hasData || desktopField.hasData || originField.hasData;

  const collectionPeriod = mobileCruxSource?.collectionPeriod || originCruxSource?.collectionPeriod || null;

  return {
    url,
    fetchedAt: new Date().toISOString(),
    mobile: normalizedMobile,
    desktop: normalizedDesktop,
    fieldData: {
      hasData: hasFieldData,
      message: hasFieldData
        ? null
        : 'Not enough real-user data available for this origin.',
      collectionPeriod: collectionPeriod ? {
        firstDate: collectionPeriod.firstDate,
        lastDate: collectionPeriod.lastDate
      } : null,
      mobile: mobileField,
      desktop: desktopField,
      origin: originField
    },
    source: {
      pageSpeed: Boolean(normalizedMobile.score !== null || normalizedDesktop.score !== null),
      crux: hasFieldData
    }
  };
}
