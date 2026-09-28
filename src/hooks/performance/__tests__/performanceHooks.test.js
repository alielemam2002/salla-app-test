import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRecommendations } from "../useRecommendations.js";
import { useGoogleApiKey } from "../useGoogleApiKey.js";
import { useTrendChart } from "../useTrendChart.js";

const recs = [
  { id: "1", impact: "high", category: "images" },
  { id: "2", impact: "low", category: "css" },
  { id: "3", impact: "medium", category: "images" },
  { id: "4", impact: "high", category: "javascript" },
  { id: "5", impact: "high", category: "images" },
];

describe("useRecommendations", () => {
  it("picks up to 3 high/medium items as top opportunities", () => {
    const { result } = renderHook(() => useRecommendations(recs));
    expect(result.current.topOpportunities.map((r) => r.id)).toEqual([
      "1",
      "3",
      "4",
    ]);
  });

  it("lists only non-empty categories with counts", () => {
    const { result } = renderHook(() => useRecommendations(recs));
    expect(result.current.categories.map((c) => [c.id, c.count])).toEqual([
      ["all", 5],
      ["images", 3],
      ["javascript", 1],
      ["css", 1],
    ]);
  });

  it("filters by category and tracks the open recommendation", () => {
    const { result } = renderHook(() => useRecommendations(recs));
    act(() => result.current.setSelectedCategory("images"));
    expect(result.current.filteredList).toHaveLength(3);

    act(() => result.current.openRecommendation(recs[1]));
    expect(result.current.activeRecommendation).toBe(recs[1]);
    act(() => result.current.closeRecommendation());
    expect(result.current.activeRecommendation).toBeNull();
  });
});

describe("useGoogleApiKey", () => {
  beforeEach(() => localStorage.clear());

  it("persists a trimmed key and clears it", () => {
    const { result } = renderHook(() => useGoogleApiKey());
    expect(result.current.hasKey).toBe(false);

    act(() => result.current.saveKey("  AIza123  "));
    expect(result.current.apiKey).toBe("AIza123");
    expect(localStorage.getItem("salla_perf_google_api_key")).toBe("AIza123");

    act(() => result.current.clearKey());
    expect(result.current.apiKey).toBe("");
    expect(localStorage.getItem("salla_perf_google_api_key")).toBeNull();
  });
});

describe("useTrendChart", () => {
  it("switches metric and recomputes data availability", () => {
    const history = [{ id: "a", performanceScore: 70, lcp: null }];
    const { result } = renderHook(() => useTrendChart(history));
    expect(result.current.hasData).toBe(true);

    act(() => result.current.setSelectedMetric("lcp"));
    expect(result.current.hasData).toBe(false);
    expect(result.current.metricConfig.label).toMatch(/LCP/);
  });
});
