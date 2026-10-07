import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MobileAppTab from "../MobileAppTab.jsx";
import {
  fetchMobileAppConfig,
  saveMobileAppConfig,
  triggerMobileAppBuild,
} from "../../../utils/mobileAppApi.js";

vi.mock("../../../utils/mobileAppApi.js", () => ({
  fetchMobileAppConfig: vi.fn(),
  saveMobileAppConfig: vi.fn(),
  triggerMobileAppBuild: vi.fn(),
  cancelMobileAppBuild: vi.fn(),
}));

function renderTab(overrides = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const showToast = vi.fn();
  const embedded = {
    auth: { getToken: () => "mock_token" },
    ...overrides,
  };

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MobileAppTab embedded={embedded} showToast={showToast} />
    </QueryClientProvider>
  );

  return { ...utils, showToast };
}

describe("MobileAppTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form and live mockup in draft mode", async () => {
    fetchMobileAppConfig.mockResolvedValue({
      success: true,
      config: {
        appName: "متجر نحلة",
        storeUrl: "https://nahla1.com",
        primaryColor: "#10B981",
        packageName: "sa.salla.app.nahla_123",
        status: "DRAFT",
      },
    });

    renderTab();

    expect(
      await screen.findByText("📱 محول متجر سلة إلى تطبيق جوال أندرويد")
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("متجر نحلة")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://nahla1.com")).toBeInTheDocument();
    expect(screen.getByText("المعاينة الحية للتطبيق")).toBeInTheDocument();
  });

  it("saves draft config on user submit", async () => {
    fetchMobileAppConfig.mockResolvedValue({
      success: true,
      config: {
        appName: "متجر نحلة",
        storeUrl: "https://nahla1.com",
        primaryColor: "#10B981",
        status: "DRAFT",
      },
    });
    saveMobileAppConfig.mockResolvedValue({ success: true });

    const { showToast } = renderTab();
    await screen.findByDisplayValue("متجر نحلة");

    const nameInput = screen.getByDisplayValue("متجر نحلة");
    fireEvent.change(nameInput, { target: { value: "نحلة كيدز" } });

    fireEvent.click(screen.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => {
      expect(saveMobileAppConfig).toHaveBeenCalledWith(
        "mock_token",
        expect.objectContaining({ appName: "نحلة كيدز" })
      );
    });
    expect(showToast).toHaveBeenCalledWith(
      "تم حفظ بيانات وهوية التطبيق بنجاح",
      "success"
    );
  });

  it("triggers build and updates view", async () => {
    fetchMobileAppConfig.mockResolvedValue({
      success: true,
      config: {
        appName: "متجر تجريبي",
        storeUrl: "https://test.salla.sa",
        primaryColor: "#10B981",
        status: "READY",
      },
    });
    saveMobileAppConfig.mockResolvedValue({ success: true });
    triggerMobileAppBuild.mockResolvedValue({
      success: true,
      status: "QUEUED",
      build: { id: "bld_1" },
    });

    const { showToast } = renderTab();
    await screen.findByDisplayValue("متجر تجريبي");

    fireEvent.click(
      screen.getByRole("button", { name: /إنشاء وبناء التطبيق الآن/ })
    );

    await waitFor(() => {
      expect(triggerMobileAppBuild).toHaveBeenCalledWith("mock_token");
    });
    expect(showToast).toHaveBeenCalledWith(
      "تم بدء عملية بناء التطبيق بنجاح! 🚀",
      "success"
    );
  });

  it("displays progress stepper when a build is actively in progress", async () => {
    fetchMobileAppConfig.mockResolvedValue({
      success: true,
      config: {
        appName: "متجر نشط",
        storeUrl: "https://active.salla.sa",
        status: "BUILDING",
        currentBuildId: "bld_active_99",
      },
    });

    renderTab();

    expect(
      await screen.findByText(/جاري إنشاء وتجميع تطبيق متجر نشط/)
    ).toBeInTheDocument();
    expect(
      screen.getByText("بناء وتجميع حزمة React Native & Gradle")
    ).toBeInTheDocument();
  });

  it("displays success card with download buttons when build is completed", async () => {
    fetchMobileAppConfig.mockResolvedValue({
      success: true,
      config: {
        appName: "متجر الأناقة",
        storeUrl: "https://elegance.salla.sa",
        packageName: "sa.salla.app.elegance",
        status: "COMPLETED",
      },
      latestBuild: {
        status: "SUCCESS",
        apkUrl: "https://download.salla.app/elegance.apk",
        aabUrl: "https://download.salla.app/elegance.aab",
      },
    });

    renderTab();

    expect(
      await screen.findByText(/تهانينا! تم إنشاء وتوقيع تطبيق متجر الأناقة بنجاح/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /تحميل ملف APK/ })
    ).toHaveAttribute("href", "https://download.salla.app/elegance.apk");
    expect(
      screen.getByRole("link", { name: /تحميل ملف AAB/ })
    ).toHaveAttribute("href", "https://download.salla.app/elegance.aab");
    expect(
      screen.getByRole("button", { name: "تعديل الهوية أو إعادة البناء" })
    ).toBeInTheDocument();
  });
});
