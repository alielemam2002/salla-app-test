import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PerformanceScoreCard from "../PerformanceScoreCard.jsx";
import CoreWebVitalsGrid from "../CoreWebVitalsGrid.jsx";
import RealUserExperienceSection from "../RealUserExperienceSection.jsx";
import OpportunitiesSection from "../OpportunitiesSection.jsx";

const mockReport = {
  url: "https://store.example.sa",
  fetchedAt: "2026-09-28T10:00:00Z",
  mobile: {
    strategy: "mobile",
    score: 72,
    scoreRating: "needs-improvement",
    testedAt: "2026-09-28T10:00:00Z",
    metrics: {
      lcp: { id: "lcp", displayValue: "2.4s", value: 2400, rating: "good" },
      inp: { id: "inp", displayValue: "180ms", value: 180, rating: "good" },
      cls: { id: "cls", displayValue: "0.08", value: 0.08, rating: "good" },
      fcp: { id: "fcp", displayValue: "1.8s", value: 1800, rating: "good" },
      ttfb: { id: "ttfb", displayValue: "0.7s", value: 700, rating: "good" },
    },
    recommendations: [
      {
        id: "uses-responsive-images",
        title: "Properly size images",
        description:
          "Serve images that are appropriately-sized to save cellular data.",
        impact: "high",
        affectedMetric: "LCP",
        category: "images",
        categoryLabel: "الصور (Images)",
        formattedSavingsMs: "1.8s",
        formattedSavingsBytes: "1.1 MB",
        whyItMatters: "خدمة صور ضخمة تبطئ التحميل.",
        howToFix: ["استخدام صور متجاوبة", "ضغط الصور"],
        items: [
          { url: "https://store.example.sa/banner.jpg", wastedBytes: 1100000 },
        ],
      },
      {
        id: "render-blocking-resources",
        title: "Eliminate render-blocking resources",
        description: "Resources are blocking the first paint of your page.",
        impact: "high",
        affectedMetric: "LCP",
        category: "rendering",
        categoryLabel: "موارد تعطل العرض (Rendering)",
        formattedSavingsMs: "0.9s",
        formattedSavingsBytes: null,
        whyItMatters: "تأخير رسم الصفحة للعميل.",
        howToFix: ["تأجيل JavaScript غير الأساسية"],
      },
    ],
  },
  desktop: {
    strategy: "desktop",
    score: 88,
    scoreRating: "needs-improvement",
    testedAt: "2026-09-28T10:00:00Z",
    metrics: {
      lcp: { id: "lcp", displayValue: "1.6s", value: 1600, rating: "good" },
      inp: { id: "inp", displayValue: "110ms", value: 110, rating: "good" },
      cls: { id: "cls", displayValue: "0.02", value: 0.02, rating: "good" },
      fcp: { id: "fcp", displayValue: "1.1s", value: 1100, rating: "good" },
      ttfb: { id: "ttfb", displayValue: "0.4s", value: 400, rating: "good" },
    },
    recommendations: [],
  },
  fieldData: {
    hasData: true,
    mobile: {
      lcp: { displayValue: "2.8s", rating: "needs-improvement", hasData: true },
      inp: { displayValue: "190ms", rating: "good", hasData: true },
      cls: { displayValue: "0.09", rating: "good", hasData: true },
      fcp: { displayValue: "2.1s", rating: "good", hasData: true },
      ttfb: { displayValue: "0.8s", rating: "good", hasData: true },
    },
    desktop: {
      lcp: { displayValue: "2.1s", rating: "good", hasData: true },
      inp: { displayValue: "150ms", rating: "good", hasData: true },
      cls: { displayValue: "0.04", rating: "good", hasData: true },
      fcp: { displayValue: "1.5s", rating: "good", hasData: true },
      ttfb: { displayValue: "0.6s", rating: "good", hasData: true },
    },
  },
};

describe("PerformanceScoreCard", () => {
  it("renders overall score and allows switching strategies", () => {
    const onSelectStrategy = vi.fn();

    render(
      <PerformanceScoreCard
        report={mockReport}
        selectedStrategy="mobile"
        onSelectStrategy={onSelectStrategy}
      />,
    );

    expect(screen.getAllByText("72")[0]).toBeInTheDocument();
    expect(screen.getByText(/Google Performance Score/i)).toBeInTheDocument();

    const desktopTab = screen.getByRole("tab", { name: /كمبيوتر/i });
    fireEvent.click(desktopTab);
    expect(onSelectStrategy).toHaveBeenCalledWith("desktop");
  });
});

describe("CoreWebVitalsGrid", () => {
  it("renders 5 web vitals with values and ratings", () => {
    render(
      <CoreWebVitalsGrid
        strategy="mobile"
        metrics={mockReport.mobile.metrics}
      />,
    );

    expect(screen.getByText("LCP")).toBeInTheDocument();
    expect(screen.getByText("2.4s")).toBeInTheDocument();

    expect(screen.getByText("INP")).toBeInTheDocument();
    expect(screen.getByText("180ms")).toBeInTheDocument();

    expect(screen.getByText("CLS")).toBeInTheDocument();
    expect(screen.getByText("0.08")).toBeInTheDocument();

    expect(screen.getByText("FCP")).toBeInTheDocument();
    expect(screen.getByText("1.8s")).toBeInTheDocument();

    expect(screen.getByText("TTFB")).toBeInTheDocument();
    expect(screen.getByText("0.7s")).toBeInTheDocument();
  });
});

describe("RealUserExperienceSection (CrUX)", () => {
  it("renders real user metrics separated from lab data when data is available", () => {
    render(<RealUserExperienceSection fieldData={mockReport.fieldData} />);

    expect(screen.getByText(/Real User Experience/i)).toBeInTheDocument();
    expect(screen.getByText("2.8s")).toBeInTheDocument();
    expect(screen.getByText("190ms")).toBeInTheDocument();
    expect(screen.getAllByText("2.1s")[0]).toBeInTheDocument();
  });

  it("renders explicit empty notice when not enough real-user data is available", () => {
    const emptyFieldData = {
      hasData: false,
      message: "Not enough real-user data available for this origin.",
    };

    render(<RealUserExperienceSection fieldData={emptyFieldData} />);

    expect(
      screen.getByText("Not enough real-user data available for this origin."),
    ).toBeInTheDocument();
  });
});

describe("OpportunitiesSection & RecommendationDetailModal", () => {
  it("renders top opportunities with potential savings and opens modal on click", () => {
    render(
      <OpportunitiesSection
        recommendations={mockReport.mobile.recommendations}
      />,
    );

    expect(screen.getByText(/Top Opportunities/i)).toBeInTheDocument();
    expect(screen.getAllByText("Properly size images")[0]).toBeInTheDocument();
    expect(screen.getAllByText("1.8s")[0]).toBeInTheDocument();

    // Click on recommendation to open modal
    fireEvent.click(screen.getAllByText("Properly size images")[0]);

    // Modal should now be visible
    expect(screen.getByText("لماذا يؤثر هذا على متجرك؟")).toBeInTheDocument();
    expect(screen.getByText("استخدام صور متجاوبة")).toBeInTheDocument();
    expect(
      screen.getByText("https://store.example.sa/banner.jpg"),
    ).toBeInTheDocument();
  });
});
