import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SettingsTab from "../SettingsTab.jsx";
import { fetchStoreInfo } from "../../../utils/storeApi.js";
import {
  fetchWhatsAppSettings,
  fetchWhatsAppTemplates,
  saveWhatsAppAccount,
  syncWhatsAppTemplates,
} from "../../../utils/whatsappApi.js";

vi.mock("../../../utils/storeApi.js", () => ({ fetchStoreInfo: vi.fn() }));
vi.mock("../../../utils/whatsappApi.js", () => ({
  fetchWhatsAppStatus: vi.fn(),
  sendCartWhatsApp: vi.fn(),
  fetchWhatsAppSettings: vi.fn(),
  saveWhatsAppSettings: vi.fn(),
  deleteWhatsAppSettings: vi.fn(),
  sendWhatsAppTest: vi.fn(),
  setWhatsAppEnabled: vi.fn(),
  saveWhatsAppAccount: vi.fn(),
  syncWhatsAppTemplates: vi.fn(),
  fetchWhatsAppTemplates: vi.fn(),
}));

const STORE = {
  success: true,
  merchantId: "1146761063",
  access: {
    authorized: true,
    expiresAt: "2026-10-14T12:00:00Z",
    offlineAccess: true,
    scopes: ["products.read_write", "offline_access"],
  },
  store: {
    id: 1146761063,
    name: "متجر الأزياء",
    username: "dev-bbr5obfkpaqctnba",
    entity: "company",
    plan: "pro",
    status: "active",
    verified: true,
    currency: "SAR",
    domain: "https://demostore.salla.sa/dev-bbr5obfkpaqctnba",
    licenses: { tax_number: "300000000000003" },
    branch: { name: "فرع العليا", city: "الرياض", codAvailable: true },
  },
  user: {
    name: "Ali",
    email: "a@x.sa",
    merchant: { commercial_number: "3552100509" },
  },
  errors: {},
};

const ACCOUNT = {
  success: true,
  storageReady: true,
  settings: {
    phoneNumberId: "1324055010792496",
    wabaId: "1478536534308215",
    tokenLast4: "abcd",
    enabled: true,
    profile: { verifiedName: "My Store", displayPhone: "15551890829" },
  },
};

const TEMPLATES = {
  success: true,
  syncedAt: new Date().toISOString(),
  templates: [
    {
      id: "1",
      name: "cart_reminder_ar",
      language: "ar",
      status: "APPROVED",
      category: "MARKETING",
      header: null,
      body: "أهلاً {{1}}، سلتك بانتظارك",
      footer: null,
      buttons: [],
      variables: { header: [], body: ["1"], buttons: [] },
    },
    {
      id: "2",
      name: "old_promo",
      language: "en_US",
      status: "REJECTED",
      category: "MARKETING",
      header: null,
      body: "Use {{1}}",
      footer: null,
      buttons: [],
      variables: { header: [], body: ["1"], buttons: [] },
    },
  ],
};

function renderTab() {
  const showToast = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SettingsTab
        embedded={{ auth: { getToken: () => "tok" } }}
        showToast={showToast}
      />
    </QueryClientProvider>,
  );
  return { showToast };
}

describe("SettingsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchStoreInfo.mockResolvedValue(STORE);
    fetchWhatsAppSettings.mockResolvedValue(ACCOUNT);
    fetchWhatsAppTemplates.mockResolvedValue(TEMPLATES);
  });

  it("shows the store's details and the app's access", async () => {
    renderTab();
    expect(await screen.findByText("متجر الأزياء")).toBeInTheDocument();
    expect(screen.getByText("باقة برو")).toBeInTheDocument();
    expect(screen.getByText("موثّق")).toBeInTheDocument();
    expect(screen.getByText("3552100509")).toBeInTheDocument();
    expect(screen.getByText("300000000000003")).toBeInTheDocument();
    expect(screen.getByText("فرع العليا")).toBeInTheDocument();
    expect(screen.getByText("offline_access")).toBeInTheDocument();
  });

  it("asks to reinstall when the store never authorized the app", async () => {
    fetchStoreInfo.mockResolvedValue({
      ...STORE,
      access: { authorized: false },
      store: null,
      user: null,
    });
    renderTab();
    expect(
      await screen.findByText(/لم يستلم التطبيق صلاحية الوصول لمتجرك/),
    ).toBeInTheDocument();
  });

  it("saves the WhatsApp account once, keeping the saved token", async () => {
    saveWhatsAppAccount.mockResolvedValue({
      success: true,
      settings: ACCOUNT.settings,
      templates: TEMPLATES,
      templatesError: null,
    });
    const { showToast } = renderTab();
    const waba = await screen.findByLabelText(
      "معرّف حساب واتساب للأعمال (WABA ID)",
    );
    expect(waba).toHaveValue("1478536534308215");
    expect(screen.getByText(/محفوظ وينتهي بـ abcd/)).toBeInTheDocument();

    fireEvent.change(waba, { target: { value: "9999999999" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ التغييرات" }));
    await waitFor(() =>
      expect(saveWhatsAppAccount).toHaveBeenCalledWith("tok", {
        phoneNumberId: "1324055010792496",
        wabaId: "9999999999",
        accessToken: "",
      }),
    );
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith("تم حفظ حساب واتساب", "success"),
    );
  });

  it("requires the WABA ID and a token when connecting", async () => {
    fetchWhatsAppSettings.mockResolvedValue({
      success: true,
      storageReady: true,
      settings: null,
    });
    fetchWhatsAppTemplates.mockResolvedValue({
      success: true,
      syncedAt: null,
      templates: [],
    });
    renderTab();
    fireEvent.change(
      await screen.findByLabelText("معرّف رقم الهاتف (Phone Number ID)"),
      { target: { value: "1324055010792496" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "ربط الحساب" }));
    expect(
      await screen.findByText("معرّف حساب واتساب للأعمال (أرقام فقط)"),
    ).toBeInTheDocument();
    expect(saveWhatsAppAccount).not.toHaveBeenCalled();
    expect(screen.getByText("اربط حساب واتساب أولًا")).toBeInTheDocument();
  });

  it("lists the approved templates from Meta, and all of them on demand", async () => {
    syncWhatsAppTemplates.mockResolvedValue(TEMPLATES);
    renderTab();
    const approved = (await screen.findByText("cart_reminder_ar")).closest(
      "li",
    );
    expect(within(approved).getByText("معتمد")).toBeInTheDocument();
    expect(within(approved).getByText("تسويقي")).toBeInTheDocument();
    expect(within(approved).getByText(/يحتاج 1 قيمة/)).toBeInTheDocument();
    expect(screen.queryByText("old_promo")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "الكل (2)" }));
    const rejected = screen.getByText("old_promo").closest("li");
    expect(within(rejected).getByText("مرفوض")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "تحديث من Meta" }));
    await waitFor(() =>
      expect(syncWhatsAppTemplates).toHaveBeenCalledWith("tok", undefined),
    );
  });
});
