import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CampaignsTab from "../CampaignsTab.jsx";
import {
  fetchAllCustomers,
  fetchCustomerGroups,
} from "../../../utils/customersApi.js";
import {
  fetchWhatsAppStatus,
  sendCampaignMessage,
} from "../../../utils/whatsappApi.js";
import { fetchAllCoupons } from "../../../utils/couponsApi.js";
import { campaignLogStore } from "../../../utils/campaigns/campaignModel.js";

vi.mock("../../../utils/customersApi.js", () => ({
  fetchAllCustomers: vi.fn(),
  fetchCustomerGroups: vi.fn(),
}));
vi.mock("../../../utils/whatsappApi.js", () => ({
  fetchWhatsAppStatus: vi.fn(),
  sendCampaignMessage: vi.fn(),
}));
vi.mock("../../../utils/couponsApi.js", () => ({
  fetchAllCoupons: vi.fn(),
}));

const customer = (over) => ({
  groups: [],
  city: "",
  isBlocked: false,
  notificationsEnabled: true,
  ...over,
});

const CUSTOMERS = [
  customer({
    id: 1,
    name: "Ahmed Ali",
    firstName: "Ahmed",
    mobile: "+966560000001",
    groups: [7],
  }),
  customer({
    id: 2,
    name: "Sara Omar",
    firstName: "Sara",
    mobile: "+966560000002",
  }),
  customer({
    id: 3,
    name: "Blocked Guy",
    firstName: "B",
    mobile: "+966560000003",
    isBlocked: true,
  }),
  customer({
    id: 4,
    name: "Quiet One",
    firstName: "Q",
    mobile: "+966560000004",
    notificationsEnabled: false,
  }),
  customer({ id: 5, name: "No Number", firstName: "N", mobile: "" }),
];

const CONNECTED = {
  success: true,
  connected: true,
  enabled: true,
  configured: true,
  storageReady: true,
  profile: { displayPhone: "15551890829", verifiedName: "My Store" },
};

function renderTab() {
  const showToast = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <CampaignsTab
        embedded={{ auth: { getToken: () => "tok" } }}
        showToast={showToast}
      />
    </QueryClientProvider>,
  );
  return { showToast };
}

const fillCampaign = () => {
  fireEvent.change(screen.getByLabelText(/اسم الحملة/), {
    target: { value: "Weekend offer" },
  });
  fireEvent.change(screen.getByLabelText(/اسم القالب/), {
    target: { value: "offer_ar" },
  });
  // {{1}} is the customer's name by default; add {{2}} = coupon.
  fireEvent.click(screen.getByRole("button", { name: "إضافة متغير" }));
  fireEvent.change(screen.getByLabelText("نوع المتغير {{2}}"), {
    target: { value: "coupon_code" },
  });
  fireEvent.change(screen.getByLabelText("كوبون المتغير {{2}}"), {
    target: { value: "SAVE20" },
  });
};

describe("CampaignsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    campaignLogStore.reset();
    fetchAllCustomers.mockResolvedValue({
      success: true,
      customers: CUSTOMERS,
      truncated: false,
    });
    fetchCustomerGroups.mockResolvedValue({
      success: true,
      groups: [{ id: 7, name: "VIP" }],
    });
    fetchWhatsAppStatus.mockResolvedValue(CONNECTED);
    fetchAllCoupons.mockResolvedValue({
      success: true,
      coupons: [
        {
          id: 1,
          code: "SAVE20",
          status: "active",
          start_date: null,
          expiry_date: "2099-01-01 00:00:00",
        },
      ],
    });
  });

  it("only lets the merchant pick customers who can receive WhatsApp", async () => {
    renderTab();
    await screen.findByText("Ahmed Ali");
    expect(screen.getByLabelText("تحديد Blocked Guy")).toBeDisabled();
    expect(screen.getByLabelText("تحديد Quiet One")).toBeDisabled();
    expect(screen.getByLabelText("تحديد No Number")).toBeDisabled();
    expect(screen.getByText("الإشعارات متوقفة في سلة")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "تحديد الكل (2)" }));
    expect(screen.getByText(/من 5/)).toHaveTextContent("تم تحديد 2 من 5");

    // Untick one.
    fireEvent.click(screen.getByLabelText("تحديد Sara Omar"));
    expect(screen.getByText(/من 5/)).toHaveTextContent("تم تحديد 1 من 5");
  });

  it("filters by customer group", async () => {
    renderTab();
    await screen.findByText("Ahmed Ali");
    fireEvent.change(await screen.findByLabelText("مجموعة العملاء"), {
      target: { value: "7" },
    });
    expect(screen.getByText("Ahmed Ali")).toBeInTheDocument();
    expect(screen.queryByText("Sara Omar")).toBeNull();
  });

  it("needs consent, then sends one at a time with each customer's name", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    sendCampaignMessage.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return { success: true, messageId: "wamid" };
    });
    const { showToast } = renderTab();
    await screen.findByText("Ahmed Ali");
    fillCampaign();
    fireEvent.click(screen.getByRole("button", { name: "تحديد الكل (2)" }));
    fireEvent.click(
      screen.getByRole("button", { name: "مراجعة وإرسال إلى 2" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("{{2}} = SAVE20")).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "إرسال إلى 2" });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByLabelText(/وافق هؤلاء العملاء/));
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(sendCampaignMessage).toHaveBeenCalledTimes(2), {
      timeout: 3000,
    });
    expect(sendCampaignMessage).toHaveBeenCalledWith("tok", {
      to: "+966560000001",
      customerName: "Ahmed",
      campaign: {
        name: "Weekend offer",
        template: "offer_ar",
        language: "ar",
        params: [
          { source: "customer_name", value: "" },
          { source: "coupon_code", value: "SAVE20" },
        ],
      },
    });
    expect(maxInFlight).toBe(1);
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        "قبلت Meta 2 من 2 رسالة.",
        "success",
      ),
    );
    expect(screen.getAllByText("قبلتها Meta")).toHaveLength(2);
    expect(await screen.findByText("الحملات السابقة")).toBeInTheDocument();
  });

  it("stops at an error that would repeat for everyone", async () => {
    sendCampaignMessage.mockResolvedValue({
      success: false,
      code: "meta_error",
      metaCode: 132001,
      error: "القالب غير موجود بهذه اللغة أو لم تعتمده Meta بعد.",
    });
    renderTab();
    await screen.findByText("Ahmed Ali");
    fillCampaign();
    fireEvent.click(screen.getByRole("button", { name: "تحديد الكل (2)" }));
    fireEvent.click(
      screen.getByRole("button", { name: "مراجعة وإرسال إلى 2" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText(/وافق هؤلاء العملاء/));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "إرسال إلى 2" }),
    );

    expect(await screen.findByText("توقفت الحملة")).toBeInTheDocument();
    expect(sendCampaignMessage).toHaveBeenCalledTimes(1);
  });

  it("can't send until WhatsApp is connected and switched on", async () => {
    fetchWhatsAppStatus.mockResolvedValue({
      ...CONNECTED,
      enabled: false,
      configured: false,
    });
    renderTab();
    expect(
      await screen.findByText("الإرسال من التطبيق متوقف"),
    ).toBeInTheDocument();
    await screen.findByText("Ahmed Ali");
    fireEvent.click(screen.getByRole("button", { name: "تحديد الكل (2)" }));
    expect(
      screen.getByRole("button", { name: "مراجعة وإرسال إلى 2" }),
    ).toBeDisabled();
  });

  it("validates the campaign before review", async () => {
    renderTab();
    await screen.findByText("Ahmed Ali");
    fireEvent.click(screen.getByRole("button", { name: "تحديد الكل (2)" }));
    fireEvent.click(screen.getByRole("button", { name: "إضافة متغير" }));
    fireEvent.change(screen.getByLabelText("نوع المتغير {{2}}"), {
      target: { value: "custom" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "مراجعة وإرسال إلى 2" }),
    );
    expect(await screen.findByText("اكتب اسمًا للحملة")).toBeInTheDocument();
    expect(screen.getByText("اكتب النص")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
