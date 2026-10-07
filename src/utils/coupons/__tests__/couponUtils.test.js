import { describe, expect, it } from "vitest";
import {
  COUPON_STATUS,
  formatDiscount,
  getCouponStatus,
  getUnmanagedSettings,
  getUsage,
  isStorewide,
  nextStatusChange,
  parseSallaDate,
} from "../couponModel.js";
import {
  describeCountdown,
  formatCountdown,
  getCountdownParts,
} from "../countdown.js";
import {
  couponToForm,
  formToCouponInput,
  inputDateToSalla,
  sallaDateToInput,
  validateCouponForm,
} from "../couponForm.js";
import { describeCouponError } from "../couponErrors.js";

// 2026-06-01 12:00:00 in store time (UTC+03:00)
const NOW = Date.parse("2026-06-01T12:00:00+03:00");

const coupon = (overrides = {}) => ({
  id: 1,
  code: "SUMMER20",
  type: "percentage",
  status: "active",
  amount: { amount: 20, currency: "SAR" },
  start_date: null,
  expiry_date: "2026-06-10 00:00:00",
  include_product_ids: [],
  exclude_product_ids: [],
  include_category_ids: [],
  exclude_category_ids: [],
  exclude_brands_ids: [],
  include_payment_methods: [],
  applied_in: "all",
  is_group: false,
  marketing_active: false,
  ...overrides,
});

describe("parseSallaDate", () => {
  it("reads Salla wall-clock dates as store time (+03:00)", () => {
    expect(parseSallaDate("2026-06-01 12:00:00")).toBe(NOW);
    expect(parseSallaDate("2026-06-01")).toBe(
      Date.parse("2026-06-01T00:00:00+03:00"),
    );
  });

  it("returns null for empty or malformed values", () => {
    expect(parseSallaDate(null)).toBeNull();
    expect(parseSallaDate("soon")).toBeNull();
  });
});

describe("getCouponStatus", () => {
  it("is scheduled before the start date", () => {
    expect(
      getCouponStatus(coupon({ start_date: "2026-06-05 00:00:00" }), NOW),
    ).toBe(COUPON_STATUS.SCHEDULED);
  });

  it("is active between start and expiry", () => {
    expect(
      getCouponStatus(coupon({ start_date: "2026-05-01 00:00:00" }), NOW),
    ).toBe(COUPON_STATUS.ACTIVE);
  });

  it("is expired at or after the expiry date", () => {
    expect(
      getCouponStatus(coupon({ expiry_date: "2026-06-01 12:00:00" }), NOW),
    ).toBe(COUPON_STATUS.EXPIRED);
  });

  it("is disabled when Salla's status is not active, whatever the dates", () => {
    expect(getCouponStatus(coupon({ status: "inactive" }), NOW)).toBe(
      COUPON_STATUS.DISABLED,
    );
  });
});

describe("nextStatusChange", () => {
  it("returns the nearest start or expiry across coupons", () => {
    const next = nextStatusChange(
      [
        coupon({ id: 1, expiry_date: "2026-06-10 00:00:00" }),
        coupon({ id: 2, start_date: "2026-06-02 00:00:00" }),
        coupon({ id: 3, expiry_date: "2026-01-01 00:00:00" }),
      ],
      NOW,
    );
    expect(next).toBe(Date.parse("2026-06-02T00:00:00+03:00"));
  });
});

describe("coupon display helpers", () => {
  it("formats percentage and fixed discounts", () => {
    expect(formatDiscount(coupon())).toBe("خصم 20%");
    expect(
      formatDiscount(
        coupon({ type: "fixed", amount: { amount: 30, currency: "SAR" } }),
      ),
    ).toBe("خصم 30 SAR");
  });

  it("detects storewide scope", () => {
    expect(isStorewide(coupon())).toBe(true);
    expect(isStorewide(coupon({ include_product_ids: ["1"] }))).toBe(false);
  });

  it("lists settings this page can't edit", () => {
    expect(getUnmanagedSettings(coupon())).toEqual([]);
    expect(
      getUnmanagedSettings(coupon({ include_payment_methods: ["all"] })),
    ).toEqual([]);
    expect(
      getUnmanagedSettings(
        coupon({ is_group: true, include_category_ids: ["5"] }),
      ),
    ).toEqual(["شروط المنتجات أو التصنيفات أو الماركات", "كوبون مجموعة"]);
  });

  it("reports usage only when Salla sends it", () => {
    expect(
      getUsage(
        coupon({ usage_limit: 1000, statistics: { num_of_usage: 143 } }),
      ),
    ).toEqual({
      used: 143,
      limit: 1000,
    });
    expect(getUsage(coupon())).toEqual({ used: null, limit: null });
  });
});

describe("countdown", () => {
  const ms = ((4 * 24 + 12) * 3600 + 33 * 60 + 17) * 1000;

  it("splits a duration into days, hours, minutes and seconds", () => {
    expect(getCountdownParts(ms)).toEqual({
      days: 4,
      hours: 12,
      minutes: 33,
      seconds: 17,
      done: false,
    });
    expect(getCountdownParts(-5).done).toBe(true);
  });

  it("formats the visible and accessible text", () => {
    const parts = getCountdownParts(ms);
    expect(formatCountdown(parts)).toBe("04 ي 12 س 33 د 17 ث");
    expect(describeCountdown(parts)).toBe("4 أيام و 12 ساعة و 33 دقيقة");
    expect(describeCountdown(getCountdownParts(61000))).toBe("دقيقة واحدة");
  });
});

describe("coupon form", () => {
  const validForm = {
    ...couponToForm(null),
    code: "SUMMER20",
    amount: "20",
    maximum_amount: "50",
    expiry_date: "2026-06-10T23:59",
  };

  it("converts between Salla dates and datetime-local values", () => {
    expect(sallaDateToInput("2026-06-10 08:30:00")).toBe("2026-06-10T08:30");
    expect(inputDateToSalla("2026-06-10T08:30")).toBe("2026-06-10 08:30:00");
  });

  it("accepts a valid storewide percentage coupon", () => {
    expect(validateCouponForm(validForm, NOW)).toEqual({});
    expect(formToCouponInput(validForm)).toEqual({
      code: "SUMMER20",
      type: "percentage",
      amount: 20,
      maximum_amount: 50,
      minimum_amount: undefined,
      start_date: undefined,
      expiry_date: "2026-06-10 23:59:00",
      usage_limit: undefined,
      usage_limit_per_user: undefined,
      free_shipping: false,
      exclude_sale_products: false,
      status: "active",
    });
  });

  it("requires code, discount, and max discount for percentage", () => {
    const errors = validateCouponForm(
      { ...validForm, code: "", amount: "", maximum_amount: "" },
      NOW,
    );
    expect(Object.keys(errors).sort()).toEqual([
      "amount",
      "code",
      "maximum_amount",
    ]);
  });

  it("enforces Salla's end-date rule and start < end", () => {
    expect(
      validateCouponForm({ ...validForm, expiry_date: "2026-06-01T23:00" }, NOW)
        .expiry_date,
    ).toMatch(/بيوم واحد على الأقل/);
    expect(
      validateCouponForm({ ...validForm, start_date: "2026-06-11T00:00" }, NOW)
        .start_date,
    ).toMatch(/يسبق تاريخ الانتهاء/);
  });

  it("rejects percentages above 100 and per-customer limit above the total", () => {
    const errors = validateCouponForm(
      {
        ...validForm,
        amount: "120",
        usage_limit: "5",
        usage_limit_per_user: "6",
      },
      NOW,
    );
    expect(errors.amount).toMatch(/100/);
    expect(errors.usage_limit_per_user).toMatch(/حد الاستخدام الكلي/);
  });

  it("maps a Salla coupon back into form values", () => {
    const form = couponToForm(
      coupon({
        maximum_amount: { amount: 50, currency: "SAR" },
        usage_limit: 1000,
        is_sale_products_exclude: true,
        status: "inactive",
      }),
    );
    expect(form).toMatchObject({
      type: "percentage",
      amount: "20",
      maximum_amount: "50",
      expiry_date: "2026-06-10T00:00",
      usage_limit: "1000",
      exclude_sale_products: true,
      active: false,
    });
  });

  it("handles coupons targeted to a specific product", () => {
    const specificForm = {
      ...validForm,
      target_type: "specific_product",
      include_product_ids: [],
    };
    // Rejects if no product selected
    expect(validateCouponForm(specificForm, NOW).include_product_ids).toMatch(
      /اختيار منتج واحد على الأقل/,
    );

    // Accepts when product ID is provided
    const validSpecific = {
      ...specificForm,
      include_product_ids: [15504447],
    };
    expect(validateCouponForm(validSpecific, NOW)).toEqual({});
    expect(formToCouponInput(validSpecific).include_product_ids).toEqual([
      15504447,
    ]);

    // Maps back from Salla coupon with include_product_ids
    const fromSalla = couponToForm(
      coupon({ include_product_ids: ["15504447"] }),
    );
    expect(fromSalla.target_type).toBe("specific_product");
    expect(fromSalla.include_product_ids).toEqual([15504447]);
  });
});

describe("describeCouponError", () => {
  it.each([
    [{ status: 400 }, /غير صالح/],
    [{ status: 401, code: "session_invalid" }, /انتهت جلسة سلة/],
    [{ status: 403, code: "missing_scope" }, /marketing.read_write/],
    [{ status: 404 }, /لم يعد موجودًا/],
    [{ status: 409 }, /بنفس الكود/],
    [{ status: 429 }, /طلبات كثيرة/],
    [{ status: 500, code: "server_error" }, /مشكلة مؤقتة/],
    [{ status: 0, code: "network_error" }, /مشكلة في الاتصال/],
  ])("explains %o", (result, pattern) => {
    expect(describeCouponError(result, "create").reason).toMatch(pattern);
  });

  it("keeps Salla's field messages and hides translation keys", () => {
    const described = describeCouponError(
      {
        status: 422,
        code: "salla_api_error",
        error: "alert.invalid_fields",
        fields: { code: ["لقد قمت بتسجيل كوبون بنفس الاسم من قبل"] },
      },
      "create",
    );
    expect(described.title).toBe("تعذّر إنشاء الكوبون.");
    expect(described.reason).toBe("بعض الحقول غير صحيحة.");
    expect(described.fieldErrors.code).toMatch(/بنفس الاسم/);
  });

  it("never surfaces the server's token diagnostics", () => {
    const described = describeCouponError({
      status: 401,
      code: "token_expired",
      error:
        'Salla rejected SALLA_ACCESS_TOKEN: … (token starts with "ory_at_…")',
    });
    expect(described.reason).not.toMatch(/starts with/);
  });
});
