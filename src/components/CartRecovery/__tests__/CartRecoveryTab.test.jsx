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
}));

const NOT_CONFIGURED = {
  success: true,
  configured: false,
  source: null,
  storageReady: true,
};
const CONFIGURED = {
  success: true,
  configured: true,
  source: "server",
  storageReady: true,
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

    const stat = (label) => screen.getByText(label).closest(".ui-stat");
    expect(within(stat("Abandoned carts")).getByText("2")).toBeInTheDocument();
    expect(
      within(stat("Potential revenue")).getByText("SAR 1,270"),
    ).toBeInTheDocument();
    expect(
      within(stat("Reachable on WhatsApp")).getByText("1"),
    ).toBeInTheDocument();
    // No invented recovery numbers in stage 1.
    expect(screen.queryByText(/Recovery rate/i)).toBeNull();

    fireEvent.click(screen.getByLabelText("Show recent carts"));
    expect(screen.getByText("Fresh Cart")).toBeInTheDocument();
    expect(screen.getByText("Recent")).toBeInTheDocument();
  });

  it("opens WhatsApp with the filled message and records it", async () => {
    renderTab();
    const link = await screen.findByRole("link", {
      name: "Send WhatsApp to Ahmed Ali",
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
    expect(await screen.findByText(/^WhatsApp just now$/)).toBeInTheDocument();

    // Sara has no mobile number in Salla: the button explains why.
    const saraRow = screen.getByText("Sara").closest("tr");
    expect(
      within(saraRow).getByRole("button", { name: "WhatsApp" }),
    ).toBeDisabled();
  });

  it("adds an existing coupon to the message", async () => {
    renderTab();
    await screen.findByText("Ahmed Ali");
    fireEvent.change(
      await screen.findByLabelText("Recovery incentive (optional)"),
      { target: { value: "SAVE10" } },
    );
    const link = screen.getByRole("link", {
      name: "Send WhatsApp to Ahmed Ali",
    });
    expect(new URL(link.href).searchParams.get("text")).toContain("SAVE10");
    expect(screen.getByText(/Preview · sample data/)).toBeInTheDocument();
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
      await screen.findByRole("button", { name: "View cart of Ahmed Ali" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Blue Shirt")).toBeInTheDocument();
    expect(within(dialog).getByText("Product #8")).toBeInTheDocument();
    expect(within(dialog).getByText("SAR 200")).toBeInTheDocument();
    // Email wasn't provided by Salla: say so, don't guess.
    expect(
      within(dialog).getByText("Not provided by Salla"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("This cart was purchased."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "WhatsApp" }),
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
    expect(await screen.findByText(/carts\.read scope/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument(),
    );
  });

  it("hides API sending until WhatsApp is configured on the server", async () => {
    renderTab();
    expect(
      await screen.findByText("WhatsApp API not connected"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send via API/ })).toBeNull();
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
      await screen.findByText("WhatsApp connected (server default account)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/doesn't include the cart link/),
    ).toBeInTheDocument();

    fireEvent.click(
      await screen.findByRole("button", { name: "Send via API to Ahmed Ali" }),
    );
    await waitFor(() =>
      expect(sendCartWhatsApp).toHaveBeenCalledWith("tok", 11, ""),
    );
    expect(
      await screen.findByText(/Sent via API just now/),
    ).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(
      "Meta accepted the message to Ahmed Ali",
      "success",
    );
    // No second message to the same cart within 24 hours.
    expect(
      screen.getByRole("button", { name: "Send via API to Ahmed Ali" }),
    ).toBeDisabled();
  });

  it("shows why Meta rejected a message on the cart's row", async () => {
    fetchWhatsAppStatus.mockResolvedValue(CONFIGURED);
    sendCartWhatsApp.mockResolvedValue({
      success: false,
      status: 422,
      code: "meta_error",
      metaCode: 131030,
      error:
        "Meta's test number can only message recipients you added in API Setup.",
    });
    renderTab();
    fireEvent.click(
      await screen.findByRole("button", { name: "Send via API to Ahmed Ali" }),
    );
    const row = screen.getByText("Ahmed Ali").closest("tr");
    expect(
      await within(row).findByText(/only message recipients you added/),
    ).toBeInTheDocument();
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
    fireEvent.click(await screen.findByLabelText("Show recent carts"));
    // Ahmed (eligible, has number); Sara has no number; Fresh Cart is recent.
    fireEvent.click(
      await screen.findByRole("button", { name: "Send to 1 shown carts" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Send to 1" }));
    await waitFor(() =>
      expect(
        screen.getByText(/Last run: 1 accepted by Meta/),
      ).toBeInTheDocument(),
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
    fireEvent.click(
      await screen.findByRole("button", { name: "Connect WhatsApp" }),
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByLabelText(/Phone Number ID/);

    // The token is required the first time.
    fireEvent.change(within(dialog).getByLabelText(/Phone Number ID/), {
      target: { value: "1324055010792496" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Template name/), {
      target: { value: "cart_reminder_ar" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(
      await within(dialog).findByText("An access token is required"),
    ).toBeInTheDocument();
    expect(saveWhatsAppSettings).not.toHaveBeenCalled();

    const token = within(dialog).getByLabelText(/Access token/);
    expect(token).toHaveAttribute("type", "password");
    fireEvent.change(token, {
      target: { value: "EAAmerchantTokenValue1234abcd" },
    });
    for (const key of ["customer_name", "cart_total", "checkout_url"]) {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Add variable" }),
      );
      const selects = within(dialog).getAllByLabelText(/Value for \{\{/);
      fireEvent.change(selects[selects.length - 1], {
        target: { value: key },
      });
    }
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

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
    expect(showToast).toHaveBeenCalledWith(
      "WhatsApp settings saved",
      "success",
    );
  });

  it("shows the saved token only as its last 4 characters", async () => {
    fetchWhatsAppStatus.mockResolvedValue({
      ...CONFIGURED,
      source: "merchant",
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
      await screen.findByText("WhatsApp connected: My Store"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp settings" }));
    const dialog = await screen.findByRole("dialog");
    const token = await within(dialog).findByLabelText(/Access token/);
    expect(token).toHaveValue("");
    expect(token).toHaveAttribute("placeholder", "••••abcd");
    expect(
      within(dialog).getByText(/Saved \(ends in abcd\)/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Send a test message")).toBeInTheDocument();
  });
});
