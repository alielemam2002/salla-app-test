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
    expect(within(active).getByText("خصم 20%")).toBeInTheDocument();
    expect(within(active).getByText("المتجر بالكامل")).toBeInTheDocument();
    expect(
      within(active).getByText("الاستخدام: 143 / 1000"),
    ).toBeInTheDocument();
    expect(within(active).getByRole("timer")).toHaveTextContent(/ينتهي خلال/);

    const scheduled = screen.getByRole("article", { name: "BLACKFRIDAY10" });
    expect(within(scheduled).getByRole("timer")).toHaveTextContent(/يبدأ خلال/);

    const expired = screen.getByRole("article", { name: "OLD5" });
    expect(within(expired).queryByRole("timer")).toBeNull();

    expect(screen.getByRole("heading", { name: /نشط/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /مجدول/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /منتهي/ })).toBeInTheDocument();
  });

  it("filters by status and searches by code", async () => {
    renderTab();
    await screen.findByRole("article", { name: "SUMMER20" });

    fireEvent.click(screen.getByRole("tab", { name: /مجدول/ }));
    expect(screen.queryByRole("article", { name: "SUMMER20" })).toBeNull();
    expect(
      screen.getByRole("article", { name: "BLACKFRIDAY10" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /الكل/ }));
    fireEvent.change(screen.getByPlaceholderText("ابحث بكود الكوبون…"), {
      target: { value: "old" },
    });
    expect(screen.getByRole("article", { name: "OLD5" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "SUMMER20" })).toBeNull();
  });

  it("shows the empty state with a create action", async () => {
    fetchAllCoupons.mockResolvedValue({ success: true, coupons: [] });
    renderTab();
    expect(await screen.findByText("لا توجد كوبونات بعد")).toBeInTheDocument();
    expect(
      screen.getByText(
        "أنشئ أول كوبون خصم يعمل على المتجر بالكامل وشاركه مع عملائك.",
      ),
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
      await screen.findByText("تعذّر تحميل الكوبونات.", {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText("boom")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(
      await screen.findByRole("article", { name: "SUMMER20" }),
    ).toBeInTheDocument();
  });

  it("creates a coupon, then refetches the list", async () => {
    createCoupon.mockResolvedValue({ success: true, coupon: { id: 9 } });
    const { showToast } = renderTab();
    await screen.findByRole("article", { name: "SUMMER20" });

    fireEvent.click(screen.getAllByRole("button", { name: "إنشاء كوبون" })[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("المتجر بالكامل")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/كود الكوبون/), {
      target: { value: "NEW15" },
    });
    fireEvent.change(within(dialog).getByLabelText(/^قيمة الخصم\*?$/), {
      target: { value: "15" },
    });
    fireEvent.change(within(dialog).getByLabelText(/الحد الأقصى للخصم/), {
      target: { value: "100" },
    });
    fireEvent.change(within(dialog).getByLabelText(/تاريخ الانتهاء/), {
      target: {
        value: storeDate(10 * DAY)
          .slice(0, 16)
          .replace(" ", "T"),
      },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "إنشاء كوبون" }),
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
    expect(showToast).toHaveBeenCalledWith("تم إنشاء الكوبون NEW15", "success");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("blocks submit on client validation errors", async () => {
    renderTab();
    await screen.findByRole("article", { name: "SUMMER20" });
    fireEvent.click(screen.getAllByRole("button", { name: "إنشاء كوبون" })[0]);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "إنشاء كوبون" }),
    );

    expect(
      await within(dialog).findByText("كود الكوبون مطلوب"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("تاريخ الانتهاء مطلوب"),
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
      await screen.findByRole("button", { name: "تعديل SUMMER20" }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "حفظ" }));

    expect(
      await within(dialog).findByText("تعذّر تعديل الكوبون."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/رفضت سلة الطلب/)).toBeInTheDocument();
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
    expect(within(card).getByText("منتجات محددة فقط")).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "تعديل SUMMER20" }),
    ).toBeDisabled();
  });

  it("deletes after confirmation", async () => {
    deleteCoupon.mockResolvedValue({ success: true, couponId: 3 });
    const { showToast } = renderTab();
    fireEvent.click(await screen.findByRole("button", { name: "حذف OLD5" }));
    fireEvent.click(screen.getByRole("button", { name: "حذف الكوبون" }));

    await waitFor(() => expect(deleteCoupon).toHaveBeenCalledWith("tok", 3));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith("تم حذف الكوبون OLD5", "success"),
    );
    expect(fetchAllCoupons).toHaveBeenCalledTimes(2);
  });

  it("offers a session refresh when there is no embedded token", async () => {
    const { embedded } = renderTab({ embedded: makeEmbedded(null) });
    fireEvent.click(
      await screen.findByRole("button", { name: "تحديث الجلسة" }),
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
    render(<CouponCountdown target={target} label="ينتهي خلال" />);

    const timer = screen.getByRole("timer");
    expect(timer).toHaveAttribute("aria-live", "off");
    expect(timer).toHaveTextContent("00 ي 00 س 01 د 01 ث");
    expect(timer).toHaveTextContent("ينتهي خلال دقيقة واحدة");

    act(() => vi.advanceTimersByTime(2000));
    expect(timer).toHaveTextContent("00 ي 00 س 00 د 59 ث");

    act(() => vi.advanceTimersByTime(60_000));
    expect(timer).toHaveTextContent("00 ي 00 س 00 د 00 ث");
    expect(vi.getTimerCount()).toBe(0);
  });
});
