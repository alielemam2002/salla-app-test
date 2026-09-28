import { describe, it, expect, beforeEach } from "vitest";
import {
  getMetricRating,
  getScoreRating,
  formatMetricValue,
} from "../thresholds.js";
import { validateAndNormalizeUrl } from "../urlValidator.js";
import {
  extractRecommendations,
  formatBytes,
  formatSavingsMs,
} from "../recommendations.js";
import { normalizePerformanceReport } from "../normalizer.js";
import {
  saveScanToHistory,
  getScanHistory,
  compareScans,
  clearPerformanceHistory,
} from "../historyStorage.js";

describe("Performance Thresholds & Ratings", () => {
  it("correctly categorizes LCP based on Google thresholds", () => {
    expect(getMetricRating("lcp", 2000)).toBe("good");
    expect(getMetricRating("lcp", 2500)).toBe("good");
    expect(getMetricRating("lcp", 3500)).toBe("needs-improvement");
    expect(getMetricRating("lcp", 4000)).toBe("needs-improvement");
    expect(getMetricRating("lcp", 4001)).toBe("poor");
  });

  it("correctly categorizes CLS based on Google thresholds", () => {
    expect(getMetricRating("cls", 0.05)).toBe("good");
    expect(getMetricRating("cls", 0.1)).toBe("good");
    expect(getMetricRating("cls", 0.18)).toBe("needs-improvement");
    expect(getMetricRating("cls", 0.25)).toBe("needs-improvement");
    expect(getMetricRating("cls", 0.26)).toBe("poor");
  });

  it("correctly categorizes INP based on Google thresholds", () => {
    expect(getMetricRating("inp", 150)).toBe("good");
    expect(getMetricRating("inp", 200)).toBe("good");
    expect(getMetricRating("inp", 350)).toBe("needs-improvement");
    expect(getMetricRating("inp", 500)).toBe("needs-improvement");
    expect(getMetricRating("inp", 550)).toBe("poor");
  });

  it("correctly rates overall Performance Score", () => {
    expect(getScoreRating(95)).toBe("good");
    expect(getScoreRating(90)).toBe("good");
    expect(getScoreRating(72)).toBe("needs-improvement");
    expect(getScoreRating(50)).toBe("needs-improvement");
    expect(getScoreRating(49)).toBe("poor");
    expect(getScoreRating(0)).toBe("poor");
  });

  it("formats metric values correctly for display", () => {
    expect(formatMetricValue("lcp", 2400)).toBe("2.4s");
    expect(formatMetricValue("cls", 0.082)).toBe("0.08");
    expect(formatMetricValue("inp", 180)).toBe("180ms");
    expect(formatMetricValue("ttfb", 680)).toBe("680ms");
  });
});

describe("URL Validation & Normalization", () => {
  it("accepts and normalizes clean store URLs", () => {
    const res = validateAndNormalizeUrl("https://example-store.salla.sa");
    expect(res.isValid).toBe(true);
    expect(res.normalizedUrl).toBe("https://example-store.salla.sa");
  });

  it("adds https:// if protocol is omitted", () => {
    const res = validateAndNormalizeUrl("mystore.com/");
    expect(res.isValid).toBe(true);
    expect(res.normalizedUrl).toBe("https://mystore.com");
  });

  it("rejects unsafe protocols like javascript: and data:", () => {
    expect(validateAndNormalizeUrl("javascript:alert(1)").isValid).toBe(false);
    expect(validateAndNormalizeUrl("data:text/html,test").isValid).toBe(false);
  });

  it("rejects malformed domains without dots", () => {
    expect(validateAndNormalizeUrl("http://localhost").isValid).toBe(false);
    expect(validateAndNormalizeUrl("not-a-domain").isValid).toBe(false);
  });
});

describe("Recommendations Engine", () => {
  it("formats bytes and savings properly", () => {
    expect(formatBytes(1500000)).toBe("1.43 MB");
    expect(formatBytes(45000)).toBe("43.9 KB");
    expect(formatSavingsMs(1850)).toBe("1.85s");
    expect(formatSavingsMs(450)).toBe("450ms");
  });

  it("extracts actionable recommendations from raw Lighthouse audits without inventing numbers", () => {
    const mockAudits = {
      "uses-responsive-images": {
        id: "uses-responsive-images",
        title: "Properly size images",
        description:
          "Serve images that are appropriately-sized to save cellular data.",
        score: 0.2,
        numericValue: 1200,
        details: {
          overallSavingsMs: 1200,
          overallSavingsBytes: 850000,
          items: [
            {
              url: "https://example.com/banner.jpg",
              totalBytes: 900000,
              wastedBytes: 850000,
            },
          ],
        },
      },
      "render-blocking-resources": {
        id: "render-blocking-resources",
        title: "Eliminate render-blocking resources",
        description: "Resources are blocking the first paint of your page.",
        score: 0,
        numericValue: 900,
        details: {
          overallSavingsMs: 900,
          items: [
            { url: "https://example.com/app.css", wastedMs: 500 },
            { url: "https://example.com/vendor.js", wastedMs: 400 },
          ],
        },
      },
      "modern-image-formats": {
        id: "modern-image-formats",
        title: "Serve images in next-gen formats",
        score: 1.0, // Passed audit, should NOT be recommended
      },
    };

    const recommendations = extractRecommendations(mockAudits);

    expect(recommendations.length).toBe(2);
    // Highest savings first
    expect(recommendations[0].id).toBe("uses-responsive-images");
    expect(recommendations[0].savingsMs).toBe(1200);
    expect(recommendations[0].savingsBytes).toBe(850000);
    expect(recommendations[0].affectedMetric).toBe("LCP");
    expect(recommendations[0].category).toBe("images");

    expect(recommendations[1].id).toBe("render-blocking-resources");
    expect(recommendations[1].savingsMs).toBe(900);
    expect(recommendations[1].affectedMetric).toBe("LCP");
  });
});

describe("Normalizer & Report Generation", () => {
  it("normalizes empty or null responses safely without throwing", () => {
    const report = normalizePerformanceReport({
      url: "https://store.example.com",
      mobile: null,
      desktop: null,
    });

    expect(report.url).toBe("https://store.example.com");
    expect(report.mobile.score).toBeNull();
    expect(report.desktop.score).toBeNull();
    expect(report.fieldData.hasData).toBe(false);
    expect(report.fieldData.message).toContain("Not enough real-user data");
  });

  it("correctly maps PageSpeed lighthouseResult and separates lab from crux", () => {
    const mockMobilePsi = {
      lighthouseResult: {
        fetchTime: "2026-09-28T10:00:00Z",
        categories: {
          performance: { score: 0.72 },
        },
        audits: {
          "largest-contentful-paint": {
            numericValue: 2400,
            displayValue: "2.4 s",
          },
          "cumulative-layout-shift": {
            numericValue: 0.08,
            displayValue: "0.08",
          },
          "first-contentful-paint": {
            numericValue: 1800,
            displayValue: "1.8 s",
          },
          "server-response-time": { numericValue: 700, displayValue: "700 ms" },
        },
      },
      loadingExperience: {
        metrics: {
          LARGEST_CONTENTFUL_PAINT_MS: {
            percentile: 2800,
            category: "AVERAGE",
          },
          INTERACTION_TO_NEXT_PAINT: { percentile: 190, category: "FAST" },
          CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 9, category: "FAST" },
        },
      },
    };

    const report = normalizePerformanceReport({
      url: "https://store.example.com",
      mobile: mockMobilePsi,
      desktop: null,
    });

    expect(report.mobile.score).toBe(72);
    expect(report.mobile.scoreRating).toBe("needs-improvement");
    expect(report.mobile.metrics.lcp.value).toBe(2400);
    expect(report.mobile.metrics.lcp.rating).toBe("good");
    expect(report.mobile.metrics.cls.value).toBe(0.08);

    // Field Data verification (CrUX)
    expect(report.fieldData.hasData).toBe(true);
    expect(report.fieldData.mobile.lcp.value).toBe(2800);
    expect(report.fieldData.mobile.inp.value).toBe(190);
    expect(report.fieldData.mobile.inp.rating).toBe("good");
  });
});

describe("History & Scan Comparison", () => {
  beforeEach(() => {
    clearPerformanceHistory();
  });

  it("saves scans and retrieves them by range and strategy", () => {
    const mockReport = {
      url: "https://store.test",
      fetchedAt: new Date().toISOString(),
      mobile: {
        score: 72,
        metrics: {
          lcp: { value: 2400 },
          inp: { value: 180 },
          cls: { value: 0.08 },
          fcp: { value: 1800 },
          ttfb: { value: 700 },
        },
      },
      desktop: {
        score: 85,
        metrics: {
          lcp: { value: 1900 },
          inp: { value: 120 },
          cls: { value: 0.02 },
          fcp: { value: 1200 },
          ttfb: { value: 500 },
        },
      },
    };

    saveScanToHistory(mockReport, "store_123");

    const mobileHistory = getScanHistory({
      url: "https://store.test",
      strategy: "mobile",
    });
    expect(mobileHistory.length).toBe(1);
    expect(mobileHistory[0].performanceScore).toBe(72);
    expect(mobileHistory[0].lcp).toBe(2400);

    const desktopHistory = getScanHistory({
      url: "https://store.test",
      strategy: "desktop",
    });
    expect(desktopHistory.length).toBe(1);
    expect(desktopHistory[0].performanceScore).toBe(85);
  });

  it("correctly compares two scans respecting metric direction", () => {
    const previous = {
      score: 68,
      lcp: 3000, // slower
      inp: 220,
      cls: 0.15,
      fcp: 2200,
      ttfb: 900,
      createdAt: "2026-09-27T10:00:00Z",
    };

    const current = {
      score: 75, // higher score is IMPROVED
      metrics: {
        lcp: { value: 2400 }, // lower time is IMPROVED
        inp: { value: 250 }, // higher time is REGRESSED
        cls: { value: 0.08 }, // lower is IMPROVED
        fcp: { value: 1800 }, // lower is IMPROVED
        ttfb: { value: 950 }, // higher is REGRESSED
      },
    };

    const diff = compareScans(current, previous);

    // Score: 68 -> 75 (+7) => improved
    expect(diff.score.status).toBe("improved");
    expect(diff.score.delta).toBe(7);

    // LCP: 3000ms -> 2400ms (-600ms) => improved
    expect(diff.lcp.status).toBe("improved");
    expect(diff.lcp.label).toContain("improvement");

    // INP: 220ms -> 250ms (+30ms) => regressed
    expect(diff.inp.status).toBe("regressed");
    expect(diff.inp.label).toContain("regression");

    // CLS: 0.15 -> 0.08 => improved
    expect(diff.cls.status).toBe("improved");

    // TTFB: 900ms -> 950ms => regressed
    expect(diff.ttfb.status).toBe("regressed");
  });
});
