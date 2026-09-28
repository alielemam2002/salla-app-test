import { describe, it, expect, beforeEach } from "vitest";
import {
  getCouponDisplaySettings,
  saveCouponDisplaySettings,
  removeCouponDisplaySettings,
  generateSmartCouponTexts,
} from "../displaySettingsStorage.js";

describe("displaySettingsStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("generates smart text based on coupon type and amount", () => {
    const p = generateSmartCouponTexts({ code: "ZAWWID10", amount: 10, type: "percentage" });
    expect(p.headline).toBe("خصم 10% على أول طلب");
    expect(p.announcement).toContain("ZAWWID10");

    const f = generateSmartCouponTexts({ code: "FIXED50", amount: 50, type: "fixed" });
    expect(f.headline).toBe("خصم 50 ر.س على أول طلب");
  });

  it("returns default settings when none are stored", () => {
    const settings = getCouponDisplaySettings("TEST10");
    expect(settings.display_product_page).toBe(true);
    expect(settings.display_cart_page).toBe(true);
    expect(settings.card_badge_title).toBe("كوبون لك");
    expect(settings.announcement_bg_color).toBe("#f59e0b");
  });

  it("saves and retrieves custom display settings", () => {
    saveCouponDisplaySettings("TEST10", {
      show_announcement_bar: true,
      announcement_text: "عرض خاص لفترة محدودة",
      display_product_page: true,
      display_category_page: true,
      display_cart_page: false,
      card_badge_title: "خصم حصري",
      card_headline_text: "وفر 20% الآن",
    });

    const loaded = getCouponDisplaySettings("TEST10");
    expect(loaded.show_announcement_bar).toBe(true);
    expect(loaded.announcement_text).toBe("عرض خاص لفترة محدودة");
    expect(loaded.display_category_page).toBe(true);
    expect(loaded.display_cart_page).toBe(false);
    expect(loaded.card_badge_title).toBe("خصم حصري");
    expect(loaded.card_headline_text).toBe("وفر 20% الآن");
  });

  it("removes settings on delete", () => {
    saveCouponDisplaySettings("DEL10", { show_announcement_bar: true });
    expect(getCouponDisplaySettings("DEL10").show_announcement_bar).toBe(true);
    removeCouponDisplaySettings("DEL10");
    expect(getCouponDisplaySettings("DEL10").show_announcement_bar).toBe(false);
  });
});
