import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CouponsTab from "../CouponsTab.jsx";
import CouponCountdown from "../CouponCountdown.jsx";
import {
  createCoupon,
  deleteCoupon,
  fetchAllCoupons,
  updateCoupon,
} from "../../../utils/couponsApi.js";

vi.mock("../../../utils/couponsApi.js", () => ({
  fetchAllCoupons: vi.fn(),
  createCoupon: vi.fn(),
  updateCoupon: vi.fn(),
  deleteCoupon: vi.fn(),
}));

// Salla wall-clock string for "now + offset" in store time (+03:00).
const storeDate = (offsetMs) =>
  new Date(Date.now() + offsetMs + 3 * 3600 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
const DAY = 24 * 3600 * 1000;

const baseCoupon = {
  type: "percentage",
  status: "active",
  amount: { amount: 20, currency: "SAR" },
  maximum_amount: { amount: 50, currency: "SAR" },
  include_product_ids: [],
  exclude_product_ids: [],
  include_category_ids: [],
  exclude_category_ids: [],
  exclude_brands_ids: [],
  include_payment_methods: [],
  applied_in: "all",
  is_group: false,
  marketing_active: false,
};

const ACTIVE = {
  ...baseCoupon,
  id: 1,
  code: "SUMMER20",
  start_date: null,
  expiry_date: storeDate(4 * DAY),
  usage_limit: 1000,
  statistics: { num_of_usage: 143 },
};
const SCHEDULED = {
  ...baseCoupon,
  id: 2,
  code: "BLACKFRIDAY10",
  type: "fixed",
  amount: { amount: 10, currency: "SAR" },
  start_date: storeDate(12 * DAY),
  expiry_date: storeDate(20 * DAY),
};
const EXPIRED = {
  ...baseCoupon,
  id: 3,
  code: "OLD5",
  expiry_date: storeDate(-DAY),
};

const makeEmbedded = (token = "tok") => ({
  auth: { getToken: vi.fn(() => token), refresh: vi.fn() },
});

function renderTab({ embedded = makeEmbedded(), showToast = vi.fn() } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CouponsTab embedded={embedded} showToast={showToast} />
    </QueryClientProvider>,
  );
  return { embedded, showToast };
}

describe("CouponsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAllCoupons.mockResolvedValue({
      success: true,
      coupons: [ACTIVE, SCHEDULED, EXPIRED],
    });
  });

  it("groups coupons by status with storewide scope, countdown and usage", async () => {
    renderTab();
    const active = await screen.findByRole("article", { name: "SUMMER20" });
    expect(within(active).getByText("20% OFF")).toBeInTheDocument();
    expect(within(active).getByText("Entire Store")).toBeInTheDocument();
    expect(within(active).getByText("Used: 143 / 1000")).toBeInTheDocument();
    expect(within(active).getByRole("timer")).toHaveTextContent(/Ends in/);

    const scheduled = screen.getByRole("article", { name: "BLACKFRIDAY10" });
    expect(within(scheduled).getByRole("timer")).toHaveTextContent(/Starts in/);

    const expired = screen.getByRole("article", { name: "OLD5" });
    expect(within(expired).queryByRole("timer")).toBeNull();

    expect(screen.getByRole("heading", { name: /Active/ })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Scheduled/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Expired/ }),
    ).toBeInTheDocument();
  });

  it("filters by status and searches by code", async () => {
    renderTab();
    await screen.findByRole("article", { name: "SUMMER20" });

    fireEvent.click(screen.getByRole("tab", { name: /Scheduled/ }));
    expect(screen.queryByRole("article", { name: "SUMMER20" })).toBeNull();
    expect(
      screen.getByRole("article", { name: "BLACKFRIDAY10" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /All/ }));
    fireEvent.change(screen.getByPlaceholderText("Search coupon code..."), {
      target: { value: "old" },
    });
    expect(screen.getByRole("article", { name: "OLD5" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "SUMMER20" })).toBeNull();
  });

  it("shows the empty state with a create action", async () => {
    fetchAllCoupons.mockResolvedValue({ success: true, coupons: [] });
    renderTab();
    expect(await screen.findByText("No coupons yet")).toBeInTheDocument();
    expect(
      screen.getByText("Create your first storewide coupon."),
    ).toBeInTheDocument();
  });

  it("shows a load error with Retry", async () => {
    const failure = {
      success: false,
      status: 500,
      code: "server_error",
      error: "boom",
    };
    // 5xx is retried once automatically, so fail both attempts.
    fetchAllCoupons
      .mockResolvedValueOnce(failure)
      .mockResolvedValueOnce(failure);
    renderTab();
    expect(
      await screen.findByText("Could not load coupons.", {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText("boom")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("article", { name: "SUMMER20" }),
    ).toBeInTheDocument();
  });

  it("creates a coupon, then refetches the list", async () => {
    createCoupon.mockResolvedValue({ success: true, coupon: { id: 9 } });
    const { showToast } = renderTab();
    await screen.findByRole("article", { name: "SUMMER20" });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Create Coupon" })[0],
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Entire Store")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/Coupon Code/), {
      target: { value: "NEW15" },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Discount\*?$/), {
      target: { value: "15" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Maximum discount/), {
      target: { value: "100" },
    });
    fireEvent.change(within(dialog).getByLabelText(/End date/), {
      target: {
        value: storeDate(10 * DAY)
          .slice(0, 16)
          .replace(" ", "T"),
      },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create Coupon" }),
    );

    await waitFor(() =>
      expect(createCoupon).toHaveBeenCalledWith(
        "tok",
        expect.objectContaining({
          code: "NEW15",
          type: "percentage",
          amount: 15,
        }),
      ),
    );
    await waitFor(() => expect(fetchAllCoupons).toHaveBeenCalledTimes(2));
    expect(showToast).toHaveBeenCalledWith("Coupon NEW15 created", "success");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("blocks submit on client validation errors", async () => {
    renderTab();
    await screen.findByRole("article", { name: "SUMMER20" });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Create Coupon" })[0],
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create Coupon" }),
    );

    expect(
      await within(dialog).findByText("Coupon code is required"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("End date is required"),
    ).toBeInTheDocument();
    expect(createCoupon).not.toHaveBeenCalled();
  });

  it("shows Salla's rejection reason and field errors", async () => {
    updateCoupon.mockResolvedValue({
      success: false,
      status: 422,
      code: "salla_api_error",
      error: "alert.invalid_fields",
      fields: { code: ["لقد قمت بتسجيل كوبون بنفس الاسم من قبل"] },
    });
    renderTab();
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit SUMMER20" }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    expect(
      await within(dialog).findByText("Could not update coupon."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Salla rejected the request/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/بنفس الاسم/)).toBeInTheDocument();
    expect(updateCoupon).toHaveBeenCalledWith(
      "tok",
      1,
      expect.objectContaining({ code: "SUMMER20" }),
    );
  });

  it("disables Edit for coupons with settings the form can't manage", async () => {
    fetchAllCoupons.mockResolvedValue({
      success: true,
      coupons: [{ ...ACTIVE, include_product_ids: ["5"] }],
    });
    renderTab();
    const card = await screen.findByRole("article", { name: "SUMMER20" });
    expect(
      within(card).getByText("Selected products only"),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "Edit SUMMER20" }),
    ).toBeDisabled();
  });

  it("deletes after confirmation", async () => {
    deleteCoupon.mockResolvedValue({ success: true, couponId: 3 });
    const { showToast } = renderTab();
    fireEvent.click(await screen.findByRole("button", { name: "Delete OLD5" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete coupon" }));

    await waitFor(() => expect(deleteCoupon).toHaveBeenCalledWith("tok", 3));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith("Coupon OLD5 deleted", "success"),
    );
    expect(fetchAllCoupons).toHaveBeenCalledTimes(2);
  });

  it("offers a session refresh when there is no embedded token", async () => {
    const { embedded } = renderTab({ embedded: makeEmbedded(null) });
    fireEvent.click(
      await screen.findByRole("button", { name: "Refresh session" }),
    );
    expect(embedded.auth.refresh).toHaveBeenCalled();
    expect(fetchAllCoupons).not.toHaveBeenCalled();
  });
});

describe("CouponCountdown", () => {
  afterEach(() => vi.useRealTimers());

  it("ticks every second without announcing to screen readers", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    const target = Date.now() + 61_000;
    render(<CouponCountdown target={target} label="Ends in" />);

    const timer = screen.getByRole("timer");
    expect(timer).toHaveAttribute("aria-live", "off");
    expect(timer).toHaveTextContent("00d 00h 01m 01s");
    expect(timer).toHaveTextContent("Ends in 1 minute");

    act(() => vi.advanceTimersByTime(2000));
    expect(timer).toHaveTextContent("00d 00h 00m 59s");

    act(() => vi.advanceTimersByTime(60_000));
    expect(timer).toHaveTextContent("00d 00h 00m 00s");
    expect(vi.getTimerCount()).toBe(0);
  });
});
