import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CartRecoveryTab from "../CartRecoveryTab.jsx";
import {
  fetchAbandonedCart,
  fetchAllAbandonedCarts,
} from "../../../utils/cartsApi.js";
import { fetchAllCoupons } from "../../../utils/couponsApi.js";
import {
  fetchWhatsAppSettings,
  fetchWhatsAppStatus,
  saveWhatsAppSettings,
  sendCartWhatsApp,
  setWhatsAppEnabled,
} from "../../../utils/whatsappApi.js";
import {
  apiSendsStore,
  contactsStore,
  settingsStore,
} from "../../../utils/cartRecovery/recoveryStorage.js";

vi.mock("../../../utils/cartsApi.js", () => ({
  fetchAllAbandonedCarts: vi.fn(),
  fetchAbandonedCart: vi.fn(),
}));
vi.mock("../../../utils/couponsApi.js", () => ({
  fetchAllCoupons: vi.fn(),
}));
vi.mock("../../../utils/whatsappApi.js", () => ({
  fetchWhatsAppStatus: vi.fn(),
  sendCartWhatsApp: vi.fn(),
  fetchWhatsAppSettings: vi.fn(),
  saveWhatsAppSettings: vi.fn(),
  deleteWhatsAppSettings: vi.fn(),
  sendWhatsAppTest: vi.fn(),
  setWhatsAppEnabled: vi.fn(),
}));

const NOT_CONFIGURED = {
  success: true,
  connected: false,
  enabled: false,
  configured: false,
  storageReady: true,
};
// The merchant's own account, connected and switched on.
const CONFIGURED = {
  success: true,
  connected: true,
  enabled: true,
  configured: true,
  storageReady: true,
  profile: { displayPhone: "15551890829", verifiedName: "My Store" },
  template: "hello_world",
  language: "en_US",
  params: [],
  invalidParams: [],
};

const riyadh = (minutesAgo) => ({
  date: new Date(Date.now() - minutesAgo * 60000 + 3 * 3600 * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", ""),
  timezone: "Asia/Riyadh",
});

const CARTS = [
  {
    id: 11,
    age_in_minutes: 120,
    total: { amount: 420, currency: "SAR" },
    checkout_url: "https://salla.sa/store/checkout/11",
    created_at: riyadh(120),
    updated_at: riyadh(90),
    customer: { name: "Ahmed Ali", mobile: "+966560000001" },
    items: [
      { id: 1, product_id: 7, quantity: 2 },
      { id: 2, product_id: 8, quantity: 1 },
    ],
  },
  {
    id: 12,
    age_in_minutes: 300,
    total: { amount: 850, currency: "SAR" },
    checkout_url: "https://salla.sa/store/checkout/12",
    created_at: riyadh(300),
    updated_at: riyadh(300),
    customer: { name: "Sara" },
    items: [{ id: 3, product_id: 9, quantity: 5 }],
  },
  {
    id: 13,
    age_in_minutes: 15,
    total: { amount: 99, currency: "SAR" },
    checkout_url: "https://salla.sa/store/checkout/13",
    created_at: riyadh(15),
    updated_at: riyadh(15),
    customer: { name: "Fresh Cart", mobile: "+966560000003" },
    items: [{ id: 4, product_id: 9, quantity: 1 }],
  },
];

const ACTIVE_COUPON = {
  id: 1,
  code: "SAVE10",
  status: "active",
  start_date: null,
  expiry_date: "2099-01-01 00:00:00",
};

function renderTab() {
  const showToast = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CartRecoveryTab
        embedded={{ auth: { getToken: () => "tok" } }}
        showToast={showToast}
      />
    </QueryClientProvider>,
  );
  return { showToast };
}

describe("CartRecoveryTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    settingsStore.reset();
    contactsStore.reset();
    apiSendsStore.reset();
    fetchWhatsAppStatus.mockResolvedValue(NOT_CONFIGURED);
    fetchAllAbandonedCarts.mockResolvedValue({
      success: true,
      carts: CARTS,
      truncated: false,
    });
    fetchAllCoupons.mockResolvedValue({
      success: true,
      coupons: [ACTIVE_COUPON],
    });
  });

  it("shows only carts past the threshold and real dashboard numbers", async () => {
    renderTab();
    expect(await screen.findByText("Ahmed Ali")).toBeInTheDocument();
    expect(screen.getByText("Sara")).toBeInTheDocument();
    expect(screen.queryByText("Fresh Cart")).toBeNull(); // 15 min < 1 hour

    const stat = (label) =>
      screen
        .getAllByText(label)
        .map((el) => el.closest(".ui-stat"))
        .find(Boolean);
    expect(within(stat("السلات المتروكة")).getByText("2")).toBeInTheDocument();
    expect(
      within(stat("الإيرادات المحتملة")).getByText("SAR 1,270"),
    ).toBeInTheDocument();
    expect(
      within(stat("يمكن مراسلتهم عبر واتساب")).getByText("1"),
    ).toBeInTheDocument();
    // No invented recovery numbers in stage 1.
    expect(screen.queryByText(/معدل الاسترجاع/)).toBeNull();

    fireEvent.click(screen.getByLabelText("إظهار السلات الحديثة"));
    expect(screen.getByText("Fresh Cart")).toBeInTheDocument();
    expect(screen.getByText("حديثة")).toBeInTheDocument();
  });

  it("opens WhatsApp with the filled message and records it", async () => {
    renderTab();
    const link = await screen.findByRole("link", {
      name: "مراسلة Ahmed Ali عبر واتساب",
    });
    const url = new URL(link.getAttribute("href"));
    expect(url.origin + url.pathname).toBe("https://wa.me/966560000001");
    const text = url.searchParams.get("text");
    expect(text).toContain("مرحبًا Ahmed");
    expect(text).toContain("SAR 420");
    expect(text).toContain("https://salla.sa/store/checkout/11");
    expect(text).not.toContain("{{"); // coupon line dropped (no coupon chosen)
    expect(link).toHaveAttribute("target", "_blank");

    fireEvent.click(link);
    expect(await screen.findByText(/^واتساب الآن$/)).toBeInTheDocument();

    // Sara has no mobile number in Salla: the button explains why.
    const saraRow = screen.getByText("Sara").closest("tr");
    expect(
      within(saraRow).getByRole("button", { name: "واتساب" }),
    ).toBeDisabled();
  });

  it("adds an existing coupon to the message", async () => {
    renderTab();
    await screen.findByText("Ahmed Ali");
    fireEvent.change(await screen.findByLabelText("حافز الاسترجاع (اختياري)"), {
      target: { value: "SAVE10" },
    });
    const link = screen.getByRole("link", {
      name: "مراسلة Ahmed Ali عبر واتساب",
    });
    expect(new URL(link.href).searchParams.get("text")).toContain("SAVE10");
    expect(screen.getByText(/معاينة · بيانات تجريبية/)).toBeInTheDocument();
  });

  it("shows cart details with product names and Salla's status", async () => {
    fetchAbandonedCart.mockResolvedValue({
      success: true,
      cart: {
        ...CARTS[0],
        status: "purchased",
        customer: { name: "Ahmed Ali", mobile: "+966560000001" },
        items: [
          {
            id: 1,
            product_id: 7,
            quantity: 2,
            amounts: { total: { amount: 200, currency: "SAR" } },
          },
          { id: 2, product_id: 8, quantity: 1 },
        ],
      },
      products: { 7: { name: "Blue Shirt" } },
    });
    renderTab();
    fireEvent.click(
      await screen.findByRole("button", { name: "عرض سلة Ahmed Ali" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Blue Shirt")).toBeInTheDocument();
    expect(within(dialog).getByText("منتج رقم 8")).toBeInTheDocument();
    expect(within(dialog).getByText("SAR 200")).toBeInTheDocument();
    // Email wasn't provided by Salla: say so, don't guess.
    expect(within(dialog).getByText("غير متوفر من سلة")).toBeInTheDocument();
    expect(within(dialog).getByText("تم شراء هذه السلة")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "واتساب" }),
    ).toBeDisabled();
    expect(fetchAbandonedCart).toHaveBeenCalledWith("tok", 11);
  });

  it("explains a missing carts.read scope", async () => {
    fetchAllAbandonedCarts.mockResolvedValue({
      success: false,
      status: 403,
      code: "missing_scope",
      error: "scope",
    });
    renderTab();
    expect(await screen.findByText(/carts\.read/)).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "إعادة المحاولة" }),
      ).toBeInTheDocument(),
    );
  });

  it("is manual-only until the merchant connects WhatsApp", async () => {
    renderTab();
    expect(await screen.findByText("الإرسال اليدوي فقط")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /إرسال عبر واتساب/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /سلة معروضة/ })).toBeNull();
    // The manual WhatsApp link is still there.
    expect(
      await screen.findByRole("link", { name: "مراسلة Ahmed Ali عبر واتساب" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("switches sending from the app off and on", async () => {
    fetchWhatsAppStatus.mockResolvedValue(CONFIGURED);
    setWhatsAppEnabled.mockResolvedValue({ success: true, settings: {} });
    const { showToast } = renderTab();
    const toggle = await screen.findByRole("switch", {
      name: /الإرسال من التطبيق/,
    });
    expect(toggle).toBeChecked();
    expect(
      await screen.findByRole("button", {
        name: "إرسال عبر واتساب إلى Ahmed Ali",
      }),
    ).toBeInTheDocument();

    fetchWhatsAppStatus.mockResolvedValue({
      ...CONFIGURED,
      enabled: false,
      configured: false,
    });
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(setWhatsAppEnabled).toHaveBeenCalledWith("tok", false),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: "إرسال عبر واتساب إلى Ahmed Ali",
        }),
      ).toBeNull(),
    );
    expect(
      screen.getByRole("switch", { name: /الإرسال من التطبيق/ }),
    ).not.toBeChecked();
    expect(showToast).toHaveBeenCalledWith(
      "تم إيقاف الإرسال من التطبيق: الإرسال اليدوي فقط",
      "success",
    );
    // Manual sending still works.
    expect(
      screen.getByRole("link", { name: "مراسلة Ahmed Ali عبر واتساب" }),
    ).toBeInTheDocument();
  });

  it("sends one cart through the API and marks it as sent", async () => {
    fetchWhatsAppStatus.mockResolvedValue(CONFIGURED);
    sendCartWhatsApp.mockResolvedValue({
      success: true,
      messageId: "wamid.1",
      status: "accepted",
    });
    const { showToast } = renderTab();
    expect(
      await screen.findByText("تم ربط واتساب: My Store"),
    ).toBeInTheDocument();
    expect(screen.getByText(/لا يتضمن رابط السلة/)).toBeInTheDocument();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "إرسال عبر واتساب إلى Ahmed Ali",
      }),
    );
    await waitFor(() =>
      expect(sendCartWhatsApp).toHaveBeenCalledWith("tok", 11, ""),
    );
    expect(
      await screen.findByText(/أُرسلت من التطبيق الآن/),
    ).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(
      "قبلت Meta الرسالة الموجهة إلى Ahmed Ali",
      "success",
    );
    // No second message to the same cart within 24 hours.
    expect(
      screen.getByRole("button", { name: "إرسال عبر واتساب إلى Ahmed Ali" }),
    ).toBeDisabled();
  });

  it("shows why Meta rejected a message on the cart's row", async () => {
    fetchWhatsAppStatus.mockResolvedValue(CONFIGURED);
    sendCartWhatsApp.mockResolvedValue({
      success: false,
      status: 422,
      code: "meta_error",
      metaCode: 131030,
      error: "رقم الاختبار من Meta يرسل فقط إلى المستلمين الذين أضفتهم.",
    });
    renderTab();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "إرسال عبر واتساب إلى Ahmed Ali",
      }),
    );
    const row = screen.getByText("Ahmed Ali").closest("tr");
    expect(await within(row).findByText(/الذين أضفتهم/)).toBeInTheDocument();
    expect(screen.queryByText(/Sent via API/)).toBeNull();
  });

  it("bulk-sends one at a time, skipping carts it can't message", async () => {
    fetchWhatsAppStatus.mockResolvedValue(CONFIGURED);
    let inFlight = 0;
    let maxInFlight = 0;
    sendCartWhatsApp.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return { success: true, messageId: "wamid", status: "accepted" };
    });
    renderTab();
    fireEvent.click(await screen.findByLabelText("إظهار السلات الحديثة"));
    // Ahmed (eligible, has number); Sara has no number; Fresh Cart is recent.
    fireEvent.click(
      await screen.findByRole("button", { name: "إرسال إلى 1 سلة معروضة" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "إرسال إلى 1" }));
    await waitFor(() =>
      expect(screen.getByText(/آخر عملية: 1 قبلتها Meta/)).toBeInTheDocument(),
    );
    expect(sendCartWhatsApp).toHaveBeenCalledTimes(1);
    expect(sendCartWhatsApp).toHaveBeenCalledWith("tok", 11, "");
    expect(maxInFlight).toBe(1);
  });

  it("lets the merchant connect their own WhatsApp account", async () => {
    fetchWhatsAppSettings.mockResolvedValue({
      success: true,
      storageReady: true,
      settings: null,
    });
    saveWhatsAppSettings.mockImplementation(async (_token, settings) => ({
      success: true,
      settings: {
        ...settings,
        accessToken: undefined,
        tokenLast4: "abcd",
        profile: { displayPhone: "15551890829", verifiedName: "My Store" },
      },
    }));
    const { showToast } = renderTab();
    fireEvent.click(await screen.findByRole("button", { name: "ربط واتساب" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByLabelText(/معرّف رقم الهاتف/);

    // The token is required the first time.
    fireEvent.change(within(dialog).getByLabelText(/معرّف رقم الهاتف/), {
      target: { value: "1324055010792496" },
    });
    fireEvent.change(within(dialog).getByLabelText(/اسم القالب/), {
      target: { value: "cart_reminder_ar" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));
    expect(
      await within(dialog).findByText("رمز الوصول مطلوب"),
    ).toBeInTheDocument();
    expect(saveWhatsAppSettings).not.toHaveBeenCalled();

    const token = within(dialog).getByLabelText(/رمز الوصول/);
    expect(token).toHaveAttribute("type", "password");
    fireEvent.change(token, {
      target: { value: "EAAmerchantTokenValue1234abcd" },
    });
    for (const key of ["customer_name", "cart_total", "checkout_url"]) {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "إضافة متغير" }),
      );
      const selects = within(dialog).getAllByLabelText(/قيمة المتغير \{\{/);
      fireEvent.change(selects[selects.length - 1], {
        target: { value: key },
      });
    }
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));

    await waitFor(() =>
      expect(saveWhatsAppSettings).toHaveBeenCalledWith("tok", {
        phoneNumberId: "1324055010792496",
        wabaId: "",
        accessToken: "EAAmerchantTokenValue1234abcd",
        template: "cart_reminder_ar",
        language: "ar",
        params: ["customer_name", "cart_total", "checkout_url"],
      }),
    );
    expect(showToast).toHaveBeenCalledWith("تم حفظ إعدادات واتساب", "success");
  });

  it("shows the saved token only as its last 4 characters", async () => {
    fetchWhatsAppStatus.mockResolvedValue({
      ...CONFIGURED,
      template: "cart_reminder_ar",
      language: "ar",
      params: ["customer_name"],
      profile: { displayPhone: "15551890829", verifiedName: "My Store" },
    });
    fetchWhatsAppSettings.mockResolvedValue({
      success: true,
      storageReady: true,
      settings: {
        phoneNumberId: "1324055010792496",
        wabaId: null,
        template: "cart_reminder_ar",
        language: "ar",
        params: ["customer_name"],
        tokenLast4: "abcd",
        profile: { displayPhone: "15551890829", verifiedName: "My Store" },
      },
    });
    renderTab();
    expect(
      await screen.findByText("تم ربط واتساب: My Store"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "إعدادات واتساب" }));
    const dialog = await screen.findByRole("dialog");
    const token = await within(dialog).findByLabelText(/رمز الوصول/);
    expect(token).toHaveValue("");
    expect(token).toHaveAttribute("placeholder", "••••abcd");
    expect(
      within(dialog).getByText(/محفوظ \(ينتهي بـ abcd\)/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("رسالة تجريبية")).toBeInTheDocument();
  });

  it("offers WhatsApp settings even before storage is set up, and explains it", async () => {
    fetchWhatsAppStatus.mockResolvedValue({
      ...NOT_CONFIGURED,
      storageReady: false,
    });
    fetchWhatsAppSettings.mockResolvedValue({
      success: true,
      storageReady: false,
      settings: null,
    });
    renderTab();
    expect(
      await screen.findByText(/تخزين الإعدادات على الخادم/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ربط واتساب" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText("تخزين الإعدادات غير مفعّل بعد"),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "حفظ" })).toBeNull();
  });
});
