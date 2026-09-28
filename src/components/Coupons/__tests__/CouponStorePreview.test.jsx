import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CouponStorePreview from "../CouponStorePreview.jsx";

describe("CouponStorePreview", () => {
  it("renders announcement bar and in-page coupon card matching designs", () => {
    render(
      <CouponStorePreview
        code="ZAWWID10"
        badgeTitle="كوبون لك"
        headlineText="خصم 10% على أول طلب"
        showAnnouncement={true}
        announcementText="عروض رمضان بدأت · شحن مجاني فوق 200 ر.س · كود: ZAWWID10"
        displayProductPage={true}
        displayCartPage={true}
      />,
    );

    // Header & Placements
    expect(screen.getByText("معاينة حية للمتجر (Storefront Live Preview)")).toBeInTheDocument();
    expect(screen.getByText("📢 الشريط الإعلاني")).toBeInTheDocument();
    expect(screen.getByText("🛍️ صفحة المنتج")).toBeInTheDocument();
    expect(screen.getByText("🛒 صفحة السلة")).toBeInTheDocument();

    // Announcement Bar (Image 2)
    expect(screen.getByText("عروض رمضان بدأت · شحن مجاني فوق 200 ر.س · كود: ZAWWID10")).toBeInTheDocument();

    // Card (Image 1)
    expect(screen.getByText("كوبون لك")).toBeInTheDocument();
    expect(screen.getByText("خصم 10% على أول طلب")).toBeInTheDocument();
    expect(screen.getByText("ZAWWID10")).toBeInTheDocument();
  });

  it("handles click-to-copy with feedback", () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <CouponStorePreview
        code="ZAWWID10"
        badgeTitle="كوبون لك"
        headlineText="خصم 10% على أول طلب"
      />,
    );

    const copyBtn = screen.getByRole("button", { name: /اضغط لنسخ الكود/i });
    fireEvent.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith("ZAWWID10");
    expect(screen.getByText("تم النسخ ✔")).toBeInTheDocument();
  });

  it("shows disabled message when announcement bar is toggled off", () => {
    render(
      <CouponStorePreview
        code="TEST10"
        showAnnouncement={false}
      />,
    );
    expect(screen.getByText("الشريط الإعلاني أعلى المتجر معطّل لهذا الكوبون")).toBeInTheDocument();
  });
});
