import { describe, it, expect } from "vitest";
import {
  buildSmoothPath,
  buildTrendChart,
  computeYDomain,
  pickTrendPoints,
} from "../trendChart.js";
import {
  formatRelativeTime,
  formatThreshold,
  getStrategyLabel,
  impactToTone,
  ratingToTone,
  truncateUrl,
} from "../formatters.js";

describe("trendChart helpers", () => {
  const history = [
    { id: "a", createdAt: "2026-09-01T00:00:00Z", performanceScore: 60 },
    { id: "b", createdAt: "2026-09-02T00:00:00Z", performanceScore: null },
    { id: "c", createdAt: "2026-09-03T00:00:00Z", performanceScore: 80 },
    { id: "d", createdAt: "2026-09-04T00:00:00Z", performanceScore: "90" },
  ];

  it("keeps only numeric points for the metric", () => {
    const pts = pickTrendPoints(history, "performanceScore");
    expect(pts.map((p) => p.id)).toEqual(["a", "c", "d"]);
    expect(pts[2].value).toBe(90);
  });

  it("anchors score domain to 100 and rounds the floor", () => {
    expect(computeYDomain([62, 90], "performanceScore")).toEqual({
      minVal: 50,
      maxVal: 100,
    });
  });

  it("pads non-score domains and never goes below zero", () => {
    const { minVal, maxVal } = computeYDomain([1000, 2000], "lcp");
    expect(minVal).toBe(850);
    expect(maxVal).toBe(2150);
  });

  it("builds a smooth path starting with a move command", () => {
    const d = buildSmoothPath([
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    ]);
    expect(d).toBe("M 0 10 C 5 10, 5 0, 10 0");
  });

  it("returns empty geometry for no points", () => {
    expect(buildTrendChart([], "performanceScore")).toEqual({
      coords: [],
      pathD: "",
      areaD: "",
      yTicks: [],
    });
  });

  it("computes coordinates, 4 ticks and first/middle/last labels", () => {
    const chart = buildTrendChart(
      pickTrendPoints(history, "performanceScore"),
      "performanceScore",
    );
    expect(chart.yTicks).toHaveLength(4);
    expect(chart.yTicks[3].label).toBe("100 نقطة");
    expect(chart.coords.map((c) => c.showLabel)).toEqual([true, true, true]);
    expect(chart.coords[0].x).toBe(50);
    expect(chart.coords[2].x).toBe(570);
    expect(chart.areaD.endsWith("Z")).toBe(true);
  });

  it("centers a single point", () => {
    const chart = buildTrendChart([{ id: "x", value: 70 }], "performanceScore");
    expect(chart.coords[0].x).toBe(310);
  });
});

describe("performance formatters", () => {
  it("maps ratings and impacts to badge tones", () => {
    expect(ratingToTone("good")).toBe("success");
    expect(ratingToTone("needs-improvement")).toBe("warning");
    expect(ratingToTone("poor")).toBe("danger");
    expect(ratingToTone("unknown")).toBe("neutral");
    expect(impactToTone("high")).toBe("danger");
    expect(impactToTone("low")).toBe("neutral");
  });

  it("labels strategies", () => {
    expect(getStrategyLabel("mobile")).toBe("الجوال");
    expect(getStrategyLabel("desktop")).toBe("الكمبيوتر");
  });

  it("formats thresholds", () => {
    expect(formatThreshold("cls", 0.1)).toBe("0.10");
    expect(formatThreshold("lcp", 2500)).toBe("2.5s");
    expect(formatThreshold("inp", 200)).toBe("200ms");
    expect(formatThreshold("inp", undefined)).toBe("");
  });

  it("formats relative time", () => {
    const now = Date.parse("2026-09-28T10:00:00Z");
    expect(formatRelativeTime("2026-09-28T09:59:40Z", now)).toBe("الآن");
    expect(formatRelativeTime("2026-09-28T09:55:00Z", now)).toBe("منذ 5 دقيقة");
    expect(formatRelativeTime("2026-09-28T09:00:00Z", now)).toBe(
      "منذ ساعة واحدة",
    );
    expect(formatRelativeTime("", now)).toBe("");
  });

  it("truncates long URLs but keeps short ones", () => {
    expect(truncateUrl("https://a.sa/x.js")).toBe("https://a.sa/x.js");
    const long = `https://cdn.example.sa/${"a".repeat(60)}/file.js`;
    const out = truncateUrl(long);
    expect(out.startsWith("https://cdn.example.sa...")).toBe(true);
    expect(out.endsWith("file.js")).toBe(true);
  });
});
