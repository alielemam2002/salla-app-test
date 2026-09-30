import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReplenishTab from "../ReplenishTab.jsx";
import {
  cancelReplenishReminder,
  fetchReplenish,
  saveReplenishSettings,
  sendReminderNow,
  sendReplenishTest,
  setProductCycle,
} from "../../../utils/replenishApi.js";
import { fetchProductsPage } from "../../../utils/productsApi.js";
import { fetchAllCoupons } from "../../../utils/couponsApi.js";

vi.mock("../../../utils/replenishApi.js", () => ({
  fetchReplenish: vi.fn(),
  saveReplenishSettings: vi.fn(),
  setProductCycle: vi.fn(),
  sendReminderNow: vi.fn(),
  cancelReplenishReminder: vi.fn(),
  sendReplenishTest: vi.fn(),
}));
vi.mock("../../../utils/productsApi.js", () => ({
  fetchProductsPage: vi.fn(),
}));
vi.mock("../../../utils/couponsApi.js", () => ({
  fetchAllCoupons: vi.fn(),
}));

const DAY = 24 * 60 * 60 * 1000;

const SETTINGS = {
  enabled: false,
  template: "replenish_ar",
  language: "ar",
  params: ["customer_name", "product_name", "product_url"],
  leadDays: 5,
  dailyLimit: 50,
  couponCode: "",
  consentAt: null,
  lastRun: null,
};

const REMINDER = {
  id: "5001:7",
  status: "scheduled",
  customerName: "Ahmed",
  mobile: "+966501806978",
  productId: "7",
  productName: "قهوة إثيوبية",
  quantity: 2,
  dueAt: new Date(Date.now() + 5 * DAY - 60000).toISOString(),
};

const OVERVIEW = {
  success: true,
  settings: SETTINGS,
  cycles: { 7: { days: 25, name: "قهوة إثيوبية" } },
  reminders: [
    REMINDER,
    {
      ...REMINDER,
      id: "4000:7",
      status: "sent",
      customerName: "Sara",
      sentAt: new Date().toISOString(),
    },
  ],
  sentToday: 3,
  blockers: [],
  whatsapp: { connected: true, enabled: true },
};

function renderTab() {
  const showToast = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ReplenishTab
        embedded={{ auth: { getToken: () => "tok" } }}
        showToast={showToast}
      />
    </QueryClientProvider>,
  );
  return { showToast };
}

describe("ReplenishTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchReplenish.mockResolvedValue(OVERVIEW);
    fetchProductsPage.mockResolvedValue({
      success: true,
      products: [
        { id: 7, name: "قهوة إثيوبية", sku: "CF-1" },
        { id: 8, name: "فلتر قهوة", sku: "FL-2" },
      ],
    });
    fetchAllCoupons.mockResolvedValue({ success: true, coupons: [] });
  });

  it("switches automatic reminders on only after the opt-in confirmation", async () => {
    saveReplenishSettings.mockResolvedValue({
      success: true,
      settings: { ...SETTINGS, enabled: true },
    });
    const { showToast } = renderTab();
    const toggle = await screen.findByRole("switch", {
      name: /إرسال التذكيرات تلقائيًا/,
    });
    fireEvent.click(toggle);
    expect(
      await screen.findByText(/أكّد أولًا أن عملاءك وافقوا/),
    ).toBeInTheDocument();
    expect(saveReplenishSettings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/أؤكد أن عملائي وافقوا/));
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(saveReplenishSettings).toHaveBeenCalledWith("tok", {
        template: "replenish_ar",
        language: "ar",
        params: ["customer_name", "product_name", "product_url"],
        leadDays: 5,
        dailyLimit: 50,
        couponCode: "",
        enabled: true,
        consent: true,
      }),
    );
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        "تم تفعيل التذكير التلقائي",
        "success",
      ),
    );
  });

  it("explains what's missing and keeps the switch off", async () => {
    fetchReplenish.mockResolvedValue({
      ...OVERVIEW,
      blockers: ["أضف متغير البيئة CRON_SECRET في Vercel ثم أعد النشر."],
    });
    renderTab();
    expect(await screen.findByText(/CRON_SECRET/)).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: /إرسال التذكيرات تلقائيًا/ }),
    ).toBeDisabled();
  });

  it("sets a product's consumption days", async () => {
    setProductCycle.mockResolvedValue({ success: true });
    renderTab();
    const input = await screen.findByLabelText("مدة استهلاك فلتر قهوة بالأيام");
    fireEvent.change(input, { target: { value: "60" } });
    const row = input.closest("tr");
    fireEvent.click(within(row).getByRole("button", { name: "حفظ" }));
    await waitFor(() =>
      expect(setProductCycle).toHaveBeenCalledWith("tok", {
        productId: 8,
        days: 60,
        name: "فلتر قهوة",
      }),
    );
    // The existing cycle shows as a chip and can be removed.
    fireEvent.click(
      screen.getByRole("button", { name: "إزالة مدة قهوة إثيوبية" }),
    );
    await waitFor(() =>
      expect(setProductCycle).toHaveBeenLastCalledWith("tok", {
        productId: "7",
        days: null,
        name: "قهوة إثيوبية",
      }),
    );
  });

  it("lists reminders, sends one now and cancels after confirming", async () => {
    sendReminderNow.mockResolvedValue({ success: true, messageId: "wamid.1" });
    cancelReplenishReminder.mockResolvedValue({ success: true });
    const { showToast } = renderTab();

    const row = (await screen.findByText("Ahmed")).closest("tr");
    expect(within(row).getByText("قهوة إثيوبية × 2")).toBeInTheDocument();
    expect(within(row).getByText("(بعد 5 أيام)")).toBeInTheDocument();
    expect(within(row).getByText("مجدول")).toBeInTheDocument();
    const sent = screen.getByText("Sara").closest("tr");
    expect(within(sent).getByText("أُرسل")).toBeInTheDocument();
    expect(within(sent).queryByRole("button", { name: /إرسال/ })).toBeNull();

    fireEvent.click(
      within(row).getByRole("button", { name: "إرسال التذكير الآن إلى Ahmed" }),
    );
    await waitFor(() =>
      expect(sendReminderNow).toHaveBeenCalledWith("tok", "5001:7"),
    );
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        "قبلت Meta التذكير الموجّه إلى Ahmed",
        "success",
      ),
    );

    fireEvent.click(
      within(row).getByRole("button", { name: "إلغاء تذكير Ahmed" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "إلغاء التذكير" }),
    );
    await waitFor(() =>
      expect(cancelReplenishReminder).toHaveBeenCalledWith("tok", "5001:7"),
    );
  });

  it("sends a test message to a number", async () => {
    sendReplenishTest.mockResolvedValue({ success: true });
    const { showToast } = renderTab();
    fireEvent.change(await screen.findByLabelText("رقم لرسالة التجربة"), {
      target: { value: "+201060820691" },
    });
    fireEvent.click(screen.getByRole("button", { name: "إرسال تجربة" }));
    await waitFor(() =>
      expect(sendReplenishTest).toHaveBeenCalledWith("tok", "+201060820691"),
    );
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        "قبلت Meta رسالة التجربة",
        "success",
      ),
    );
  });

  it("switches between direct text mode and template mode in settings", async () => {
    renderTab();
    const textTab = await screen.findByRole("tab", {
      name: /رسالة نصية مباشرة/,
    });
    fireEvent.click(textTab);
    expect(
      screen.getByLabelText(/نص رسالة الواتساب المباشرة/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/اسم القالب المعتمد/)).toBeNull();

    const templateTab = await screen.findByRole("tab", {
      name: /قالب رسمي معتمد/,
    });
    fireEvent.click(templateTab);
    expect(screen.getByLabelText(/اسم القالب المعتمد/)).toBeInTheDocument();
  });

  it("switches to customer orders history and opens custom reminder modal", async () => {
    renderTab();
    const ordersTab = await screen.findByRole("tab", {
      name: /سجل مبيعات وطلبات العملاء/,
    });
    fireEvent.click(ordersTab);

    expect(
      await screen.findByText("مبيعات وطلبات العملاء (سجل إعادة الشراء)"),
    ).toBeInTheDocument();
    expect(screen.getByText("العملاء في السجل")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "تذكير عميل محدد" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "تذكير عميل محدد" }));
    expect(
      await screen.findByText("إرسال تذكير إعادة شراء لعميل محدد"),
    ).toBeInTheDocument();
  });
});
