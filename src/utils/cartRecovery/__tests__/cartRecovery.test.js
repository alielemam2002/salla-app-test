import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isEligible,
  itemCount,
  sallaDateMs,
  summarizeCarts,
  timeAgo,
} from "../cartModel.js";
import {
  cartMessageValues,
  renderTemplate,
  unknownVariables,
  whatsappNumber,
  whatsappUrl,
} from "../whatsappMessage.js";
import { fetchAllAbandonedCarts } from "../../cartsApi.js";

const cart = (over = {}) => ({
  id: 1,
  age_in_minutes: 90,
  total: { amount: 420, currency: "SAR" },
  checkout_url: "https://salla.sa/store/checkout/1",
  customer: { name: "Ahmed Ali", mobile: "+966560000000" },
  items: [{ quantity: 2 }, { quantity: 1 }],
  ...over,
});

describe("cart model", () => {
  it("reads Salla store time as Riyadh (+03:00)", () => {
    expect(
      sallaDateMs({
        date: "2025-01-21 17:09:39.000000",
        timezone: "Asia/Riyadh",
      }),
    ).toBe(Date.parse("2025-01-21T14:09:39Z"));
    expect(sallaDateMs(null)).toBeNull();
    expect(timeAgo(Date.now() - 2 * 3600 * 1000)).toBe("2h ago");
  });

  it("uses Salla's age to apply the 'abandoned after' threshold", () => {
    expect(isEligible(cart({ age_in_minutes: 59 }), 60)).toBe(false);
    expect(isEligible(cart({ age_in_minutes: 60 }), 60)).toBe(true);
    expect(itemCount(cart())).toBe(3);
  });

  it("sums potential revenue per currency, only for eligible carts", () => {
    const summary = summarizeCarts(
      [
        cart(),
        cart({ id: 2, total: { amount: 100.5, currency: "SAR" } }),
        cart({ id: 3, age_in_minutes: 10 }),
        cart({ id: 4, total: { amount: 50, currency: "USD" }, customer: {} }),
      ],
      60,
    );
    expect(summary).toEqual({
      total: 4,
      eligible: 3,
      withPhone: 2,
      revenue: [
        { currency: "SAR", amount: 520.5 },
        { currency: "USD", amount: 50 },
      ],
    });
  });
});

describe("WhatsApp message", () => {
  const template =
    "Hi {{customer_name}}\nTotal {{cart_total}}\nUse code {{coupon_code}}\n{{checkout_url}}";

  it("fills variables and drops the coupon line when no coupon is chosen", () => {
    const values = cartMessageValues(cart(), { locale: "en" });
    expect(renderTemplate(template, values)).toBe(
      "Hi Ahmed\nTotal SAR 420\nhttps://salla.sa/store/checkout/1",
    );
    const withCoupon = cartMessageValues(cart(), {
      locale: "en",
      couponCode: "SAVE10",
    });
    expect(renderTemplate(template, withCoupon)).toMatch(/Use code SAVE10/);
  });

  it("never invents a customer name", () => {
    expect(
      cartMessageValues(cart({ customer: {} }), { locale: "ar" }).customer_name,
    ).toBe("عميلنا العزيز");
  });

  it("flags variables it can't fill", () => {
    expect(unknownVariables("{{store_name}} {{cart_total}}")).toEqual([
      "store_name",
    ]);
  });

  it("builds wa.me numbers only from international mobiles", () => {
    expect(whatsappNumber("+966 56 000 0000")).toBe("966560000000");
    expect(whatsappNumber("00966560000000")).toBe("966560000000");
    expect(whatsappNumber("966560000000")).toBe("966560000000");
    expect(whatsappNumber("0560000000")).toBeNull();
    expect(whatsappNumber("")).toBeNull();
    expect(whatsappUrl("966560000000", "مرحبًا & أهلا")).toBe(
      "https://wa.me/966560000000?text=%D9%85%D8%B1%D8%AD%D8%A8%D9%8B%D8%A7%20%26%20%D8%A3%D9%87%D9%84%D8%A7",
    );
  });
});

describe("fetchAllAbandonedCarts", () => {
  afterEach(() => vi.restoreAllMocks());

  it("follows Salla's `next` cursor page by page", async () => {
    const pages = [
      { success: true, carts: [{ id: 1 }], pagination: { next: "…page=2" } },
      { success: true, carts: [{ id: 2 }], pagination: { next: null } },
    ];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) => {
        const { page } = JSON.parse(init.body);
        return new Response(JSON.stringify(pages[page - 1]));
      });
    const result = await fetchAllAbandonedCarts("tok");
    expect(result).toEqual({
      success: true,
      carts: [{ id: 1 }, { id: 2 }],
      truncated: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
