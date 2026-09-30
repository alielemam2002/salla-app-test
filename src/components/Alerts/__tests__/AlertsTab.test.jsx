import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AlertsTab from "../AlertsTab.jsx";
import {
  clearStockAlerts,
  fetchAlertsOverview,
  fetchStockLevels,
  markAlertsRead,
  saveAlertThreshold,
} from "../../../utils/alertsApi.js";

vi.mock("../../../utils/alertsApi.js", () => ({
  fetchAlertsOverview: vi.fn(),
  fetchStockLevels: vi.fn(),
  saveAlertThreshold: vi.fn(),
  markAlertsRead: vi.fn(),
  clearStockAlerts: vi.fn(),
}));

const NOT_LINKED = {
  success: true,
  setup: { storage: true, webhookSecret: false },
  settings: { threshold: 5 },
  alerts: [],
  unread: 0,
  lastOrder: null,
};

const ALERT = {
  id: "2116149737:7",
  at: new Date(Date.now() - 5 * 60000).toISOString(),
  kind: "out",
  orderId: 2116149737,
  orderRef: 41027662,
  customer: "Mohammed Ali",
  productId: "7",
  productName: "بيتزا",
  sku: "PZ-1",
  ordered: 2,
  quantity: 0,
  unread: true,
};

const STOCK = {
  success: true,
  threshold: 5,
  scanned: 40,
  truncated: false,
  out: [{ id: 7, name: "بيتزا", sku: "PZ-1", quantity: 0, kind: "out" }],
  low: [{ id: 8, name: "برجر", sku: "BG-1", quantity: 3, kind: "low" }],
};

function renderTab() {
  const showToast = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AlertsTab
        embedded={{ auth: { getToken: () => "tok" } }}
        showToast={showToast}
      />
    </QueryClientProvider>,
  );
  return { showToast };
}

describe("AlertsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAlertsOverview.mockResolvedValue(NOT_LINKED);
    fetchStockLevels.mockResolvedValue(STOCK);
  });

  it("explains how to link new orders, with this app's webhook URL", async () => {
    renderTab();
    expect(
      await screen.findByText("اربط الطلبات الجديدة بالتطبيق"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${window.location.origin}/api/salla-webhook`),
    ).toBeInTheDocument();
    expect(screen.getByText("SALLA_WEBHOOK_SECRET")).toBeInTheDocument();
  });

  it("shows products that ran out or are running low", async () => {
    renderTab();
    const table = (await screen.findByText("برجر")).closest("table");
    expect(within(table).getByText("نفد من المخزون")).toBeInTheDocument();
    expect(within(table).getByText("باقي 3")).toBeInTheDocument();
    expect(screen.getByText("نفد: 1")).toBeInTheDocument();
    expect(screen.getByText("قارب على النفاد: 1")).toBeInTheDocument();
  });

  it("lists order alerts and marks them read", async () => {
    fetchAlertsOverview.mockResolvedValue({
      ...NOT_LINKED,
      setup: { storage: true, webhookSecret: true },
      alerts: [ALERT],
      unread: 1,
      lastOrder: { at: ALERT.at, orderId: "2116149737" },
    });
    markAlertsRead.mockResolvedValue({ success: true });
    renderTab();
    expect(
      await screen.findByText("تنبيهات الطلبات (1 جديد)"),
    ).toBeInTheDocument();
    const item = screen.getByText(/من Mohammed Ali/).closest("li");
    expect(within(item).getByText("بيتزا")).toBeInTheDocument();
    expect(within(item).getByText("#41027662")).toBeInTheDocument();
    expect(within(item).getByText("جديد")).toBeInTheDocument();
    expect(screen.getByText(/آخر طلب وصل للتطبيق/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "تحديد الكل كمقروء" }));
    await waitFor(() =>
      expect(markAlertsRead).toHaveBeenCalledWith("tok", undefined),
    );
  });

  it("clears alerts after confirming", async () => {
    fetchAlertsOverview.mockResolvedValue({
      ...NOT_LINKED,
      setup: { storage: true, webhookSecret: true },
      alerts: [{ ...ALERT, unread: false }],
      lastOrder: { at: ALERT.at },
    });
    clearStockAlerts.mockResolvedValue({ success: true });
    renderTab();
    fireEvent.click(
      await screen.findByRole("button", { name: "مسح كل التنبيهات" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "مسح" }));
    await waitFor(() => expect(clearStockAlerts).toHaveBeenCalled());
  });

  it("saves the threshold for both lists", async () => {
    saveAlertThreshold.mockResolvedValue({
      success: true,
      settings: { threshold: 10 },
    });
    const { showToast } = renderTab();
    const select = await screen.findByLabelText("نبّهني عندما تصل الكمية إلى");
    await waitFor(() => expect(select).not.toBeDisabled());
    fireEvent.change(select, { target: { value: "10" } });
    await waitFor(() =>
      expect(saveAlertThreshold).toHaveBeenCalledWith("tok", 10),
    );
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith("تم حفظ حد التنبيه", "success"),
    );
  });

  it("explains a missing products scope", async () => {
    fetchStockLevels.mockResolvedValue({
      success: false,
      status: 403,
      code: "missing_scope",
      error: "scope",
    });
    renderTab();
    expect(
      await screen.findByText(/لا يملك صلاحية المنتجات/),
    ).toBeInTheDocument();
  });
});
