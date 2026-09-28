import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PerformanceCenterTab from "../PerformanceCenterTab.jsx";
import ScanComparisonBanner from "../ScanComparisonBanner.jsx";
import PerformanceTrendChart from "../PerformanceTrendChart.jsx";
import ScanErrorBanner from "../ScanErrorBanner.jsx";

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PerformanceCenterTab token={null} appId={null} />
    </QueryClientProvider>,
  );
}

describe("PerformanceCenterTab", () => {
  beforeEach(() => localStorage.clear());

  it("shows the welcome state and a disabled scan button with no URL", () => {
    renderTab();
    expect(
      screen.getByText("جاهز لفحص متجرك واكتشاف فرص التحسين؟"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /فحص أداء المتجر/ }),
    ).toBeDisabled();
  });

  it("shows a validation error for an invalid URL", () => {
    renderTab();
    fireEvent.change(screen.getByLabelText("رابط المتجر المراد فحصه"), {
      target: { value: "not a url" },
    });
    fireEvent.click(screen.getByRole("button", { name: /فحص أداء المتجر/ }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("opens the API key dialog and saves the key to localStorage", () => {
    renderTab();
    fireEvent.click(
      screen.getByRole("button", { name: "إعداد مفتاح Google API" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("إعداد مفتاح Google API المجاني");

    fireEvent.change(screen.getByLabelText(/مفتاح API الخاص بك/), {
      target: { value: " AIzaTest " },
    });
    fireEvent.click(screen.getByRole("button", { name: "حفظ المفتاح" }));

    expect(localStorage.getItem("salla_perf_google_api_key")).toBe("AIzaTest");
    expect(screen.getByText("تم الحفظ بنجاح!")).toBeInTheDocument();
  });
});

describe("ScanComparisonBanner", () => {
  it("renders nothing without comparison data", () => {
    const { container } = render(<ScanComparisonBanner data={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders deltas and skips metrics without data", () => {
    render(
      <ScanComparisonBanner
        strategy="mobile"
        data={{
          previousScan: { createdAt: "2026-09-27T10:00:00Z" },
          comparison: {
            score: {
              status: "improved",
              current: 80,
              previous: 70,
              label: "+10",
            },
            lcp: { status: "no-data" },
          },
        }}
      />,
    );
    expect(screen.getByText("Performance Score")).toBeInTheDocument();
    expect(screen.getByText("تحسن")).toBeInTheDocument();
    expect(screen.queryByText(/LCP/)).not.toBeInTheDocument();
  });
});

describe("PerformanceTrendChart", () => {
  it("shows an empty state, then a labelled chart when history exists", () => {
    const onDaysChange = vi.fn();
    const { rerender } = render(
      <PerformanceTrendChart history={[]} onDaysChange={onDaysChange} />,
    );
    expect(screen.getByText(/لا توجد فحوصات مسجلة/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "7D" }));
    expect(onDaysChange).toHaveBeenCalledWith(7);

    rerender(
      <PerformanceTrendChart
        history={[
          {
            id: "a",
            createdAt: "2026-09-01T00:00:00Z",
            performanceScore: 60,
          },
          {
            id: "b",
            createdAt: "2026-09-02T00:00:00Z",
            performanceScore: 75,
          },
        ]}
        onDaysChange={onDaysChange}
      />,
    );
    expect(
      screen.getByRole("img", { name: /آخر قيمة 75 نقطة/ }),
    ).toBeInTheDocument();
  });
});

describe("ScanErrorBanner", () => {
  it("renders error message and action buttons", () => {
    const onRetry = vi.fn();
    const onOpenApiKey = vi.fn();
    const onRetryDesktop = vi.fn();

    render(
      <ScanErrorBanner
        message="Lighthouse returned error: Something went wrong."
        onOpenApiKey={onOpenApiKey}
        onRetry={onRetry}
        onRetryDesktop={onRetryDesktop}
      />,
    );

    expect(
      screen.getByText("Lighthouse returned error: Something went wrong."),
    ).toBeInTheDocument();

    const desktopBtn = screen.getByRole("button", {
      name: /تجربة فحص ديسكتوب/,
    });
    expect(desktopBtn).toBeInTheDocument();
    fireEvent.click(desktopBtn);
    expect(onRetryDesktop).toHaveBeenCalledTimes(1);

    const apiKeyBtn = screen.getByRole("button", {
      name: /إدخال Google API Key/,
    });
    fireEvent.click(apiKeyBtn);
    expect(onOpenApiKey).toHaveBeenCalledTimes(1);

    const retryBtn = screen.getByRole("button", { name: /إعادة المحاولة/ });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render desktop button when onRetryDesktop is not provided", () => {
    render(
      <ScanErrorBanner
        message="Some error"
        onOpenApiKey={() => {}}
        onRetry={() => {}}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /تجربة فحص ديسكتوب/ }),
    ).not.toBeInTheDocument();
  });
});

