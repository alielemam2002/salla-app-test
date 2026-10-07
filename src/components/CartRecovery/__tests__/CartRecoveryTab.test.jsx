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
  fetchTemplateBindings,
  fetchWhatsAppSettings,
  fetchWhatsAppStatus,
  fetchWhatsAppTemplates,
  saveTemplateBinding,
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
  fetchWhatsAppTemplates: vi.fn(),
  fetchTemplateBindings: vi.fn(),
  saveTemplateBinding: vi.fn(),
  fetchSignupConfig: vi.fn(),
  completeWhatsAppSignup: vi.fn(),
}));

// The merchant's library (Settings → read from Meta).
const CART_TEMPLATE = {
  id: "t1",
  name: "cart_reminder_ar",
  language: "ar",
  status: "APPROVED",
  category: "MARKETING",
  parameterFormat: "POSITIONAL",
  header: null,
  body: "أهلاً {{1}}، سلتك بانتظارك",
  footer: null,
  buttons: [{ type: "URL", text: "أكمل الطلب", url: "https://salla.sa/{{1}}" }],
  variables: {
    header: [],
    body: ["1"],
    buttons: [{ index: 0, text: "أكمل الطلب", url: "https://salla.sa/{{1}}" }],
  },
};

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
  const onNavigate = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CartRecoveryTab
        embedded={{ auth: { getToken: () => "tok" } }}
        showToast={showToast}
        onNavigate={onNavigate}
      />
    </QueryClientProvider>,
  );
  return { showToast, onNavigate };
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
    // Embedded Signup isn't set up on the server.
    expect(
      screen.queryByRole("button", { name: "ربط واتساب عبر فيسبوك" }),
    ).toBeNull();
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
      expect(sendCartWhatsApp).toHaveBeenCalledWith("tok", 11, "", undefined),
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

  it("sends the written message as normal text when chosen", async () => {
    fetchWhatsAppStatus.mockResolvedValue(CONFIGURED);
    sendCartWhatsApp.mockResolvedValue({ success: true, messageId: "wamid.2" });
    renderTab();
    fireEvent.click(await screen.findByRole("tab", { name: "رسالة نصية" }));
    expect(
      screen.getByText(/راسلك العميل خلال آخر 24 ساعة/),
    ).toBeInTheDocument();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "إرسال عبر واتساب إلى Ahmed Ali",
      }),
    );
    await waitFor(() => expect(sendCartWhatsApp).toHaveBeenCalledTimes(1));
    const [token, cartId, , options] = sendCartWhatsApp.mock.calls[0];
    expect([token, cartId]).toEqual(["tok", 11]);
    expect(options.mode).toBe("text");
    // The editor's message, filled in for this cart.
    expect(options.text).toContain("Ahmed");
    expect(options.text).toContain("SAR 420");
    expect(options.text).toContain("https://salla.sa/store/checkout/11");
    expect(options.text).not.toContain("{{");
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
    expect(sendCartWhatsApp).toHaveBeenCalledWith("tok", 11, "", undefined);
    expect(maxInFlight).toBe(1);
  });

  it("sends the merchant to Settings to connect WhatsApp", async () => {
    fetchWhatsAppStatus.mockResolvedValue({
      ...NOT_CONFIGURED,
      storageReady: false,
    });
    const { onNavigate } = renderTab();
    expect(
      await screen.findByText(/تخزين الإعدادات على الخادم/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "الإعدادات" }));
    expect(onNavigate).toHaveBeenCalledWith("settings");
  });

  it("picks the reminder template from the library and saves it", async () => {
    fetchWhatsAppStatus.mockResolvedValue(CONFIGURED);
    fetchWhatsAppSettings.mockResolvedValue({
      success: true,
      storageReady: true,
      settings: {
        phoneNumberId: "1324055010792496",
        wabaId: "1478536534308215",
        tokenLast4: "abcd",
        enabled: true,
        profile: { displayPhone: "15551890829", verifiedName: "My Store" },
      },
    });
    fetchWhatsAppTemplates.mockResolvedValue({
      success: true,
      syncedAt: "2026-09-30T00:00:00Z",
      templates: [CART_TEMPLATE],
    });
    fetchTemplateBindings.mockResolvedValue({ success: true, bindings: {} });
    saveTemplateBinding.mockImplementation(async (_token, { binding }) => ({
      success: true,
      binding: { ...binding, name: "cart_reminder_ar", language: "ar" },
      bindings: {
        cart: { ...binding, name: "cart_reminder_ar", language: "ar" },
      },
    }));
    const { showToast } = renderTab();
    fireEvent.click(
      await screen.findByRole("button", { name: "قالب التذكير" }),
    );
    const dialog = await screen.findByRole("dialog");
    // No account fields here: the account lives in Settings.
    expect(within(dialog).queryByLabelText(/رمز الوصول/)).toBeNull();
    expect(await within(dialog).findByText("My Store")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("قالب تذكير السلة"), {
      target: { value: "t1" },
    });
    // Sensible defaults: {{1}} = name, the button = the checkout link.
    expect(within(dialog).getByLabelText("{{1}} في النص")).toHaveValue(
      "customer_name",
    );
    expect(within(dialog).getByLabelText("رابط زر «أكمل الطلب»")).toHaveValue(
      "checkout_url",
    );
    expect(
      within(dialog).getByText("أهلاً [اسم العميل]، سلتك بانتظارك"),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ القالب" }));
    await waitFor(() =>
      expect(saveTemplateBinding).toHaveBeenCalledWith("tok", {
        feature: "cart",
        binding: {
          templateId: "t1",
          slots: [
            expect.objectContaining({ part: "body", source: "customer_name" }),
            expect.objectContaining({
              part: "button",
              index: 0,
              source: "checkout_url",
            }),
          ],
        },
      }),
    );
    expect(showToast).toHaveBeenCalledWith(
      "تم حفظ قالب تذكير السلة",
      "success",
    );
    // Once saved, it can be tried on a real number.
    expect(await within(dialog).findByText("رسالة تجربة")).toBeInTheDocument();
  });

  it("navigates to Settings when the settings button is clicked in the status alert", async () => {
    fetchWhatsAppStatus.mockResolvedValue(NOT_CONFIGURED);
    const { onNavigate } = renderTab();
    const settingsBtn = await screen.findByRole("button", {
      name: "الإعدادات",
    });
    fireEvent.click(settingsBtn);
    expect(onNavigate).toHaveBeenCalledWith("settings");
  });
});
