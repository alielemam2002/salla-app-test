import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BulkDiscountModal from "../BulkDiscountModal.jsx";
import * as discountsApi from "../../../utils/discountsApi.js";

describe("BulkDiscountModal", () => {
  const mockSelectedProducts = [
    { id: 10, name: "T-Shirt", price: 100, sale_price: null },
    {
      id: 20,
      name: "Jeans",
      price: { amount: 200, currency: "SAR" },
      sale_price: 180,
    },
  ];

  const mockCategories = [
    { id: 1, name: "Clothing", products_count: 15 },
    { id: 2, name: "Shoes", products_count: 8 },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <BulkDiscountModal
        isOpen={false}
        onClose={vi.fn()}
        selectedProducts={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders modal header and options when isOpen is true", () => {
    render(
      <BulkDiscountModal
        isOpen={true}
        onClose={vi.fn()}
        selectedProducts={mockSelectedProducts}
        categories={mockCategories}
      />,
    );

    expect(screen.getByText("خصم جماعي على المنتجات")).toBeInTheDocument();
    expect(screen.getByText("المنتجات المحددة")).toBeInTheDocument();
    expect(screen.getByText("التصنيف")).toBeInTheDocument();
    expect(screen.getByText("كل المنتجات")).toBeInTheDocument();
  });

  it("toggles between Apply Discount and Remove Discount modes", () => {
    render(
      <BulkDiscountModal
        isOpen={true}
        onClose={vi.fn()}
        selectedProducts={mockSelectedProducts}
      />,
    );

    const removeBtn = screen.getByRole("button", {
      name: /^إزالة الخصم$/,
    });
    fireEvent.click(removeBtn);

    expect(screen.getByText("إزالة خصومات المنتجات")).toBeInTheDocument();
    expect(screen.getByText(/إعادة الأسعار إلى أصلها/)).toBeInTheDocument();

    const applyBtn = screen.getByRole("button", {
      name: /^تطبيق الخصم$/,
    });
    fireEvent.click(applyBtn);

    expect(screen.getByText("خصم جماعي على المنتجات")).toBeInTheDocument();
    expect(screen.getByText(/إعداد الخصم/)).toBeInTheDocument();
  });

  it("switches discount type between percentage and fixed", () => {
    render(
      <BulkDiscountModal
        isOpen={true}
        onClose={vi.fn()}
        selectedProducts={mockSelectedProducts}
      />,
    );

    const fixedBtn = screen.getByRole("button", {
      name: /مبلغ ثابت/,
    });
    fireEvent.click(fixedBtn);

    expect(screen.getByText("SAR")).toBeInTheDocument();
  });

  it("displays sample preview with calculated sale prices", () => {
    render(
      <BulkDiscountModal
        isOpen={true}
        onClose={vi.fn()}
        selectedProducts={mockSelectedProducts}
      />,
    );

    // Default is 20% discount on T-Shirt (100 SAR -> 80 SAR)
    expect(screen.getByText("T-Shirt")).toBeInTheDocument();
    expect(screen.getByText("80 SAR")).toBeInTheDocument();

    // Jeans (200 SAR -> 160 SAR) with replace note
    expect(screen.getByText("Jeans")).toBeInTheDocument();
    expect(screen.getByText("160 SAR")).toBeInTheDocument();
    expect(screen.getByText(/يستبدل سعر التخفيض الحالي/)).toBeInTheDocument();
  });

  it("advances to confirmation and executes bulk discount on Salla", async () => {
    const handleSuccess = vi.fn();
    const showToast = vi.fn();

    vi.spyOn(discountsApi, "bulkUpdateProductPrices").mockResolvedValue({
      success: true,
      message: "Queued for update",
    });

    render(
      <BulkDiscountModal
        isOpen={true}
        onClose={vi.fn()}
        selectedProducts={mockSelectedProducts}
        onSuccess={handleSuccess}
        showToast={showToast}
        token="test-token"
      />,
    );

    // Step 1: Click Review & Apply
    const reviewBtn = screen.getByRole("button", {
      name: /مراجعة وتطبيق الخصم/,
    });
    fireEvent.click(reviewBtn);

    // Expect confirmation view
    expect(
      await screen.findByText(/يرجى تأكيد التحديث الجماعي/),
    ).toBeInTheDocument();

    // Step 2: Confirm & Apply
    const confirmBtn = screen.getByRole("button", {
      name: /تأكيد وتطبيق الخصم/,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(discountsApi.bulkUpdateProductPrices).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText("تمت العملية بنجاح")).toBeInTheDocument();
      expect(handleSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "apply",
          count: 2,
        }),
      );
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("تم تطبيق الخصم الجماعي على 2 منتج"),
        "success",
      );
    });
  });

  it("handles remove discount confirmation and execution", async () => {
    const handleSuccess = vi.fn();
    const showToast = vi.fn();

    vi.spyOn(discountsApi, "bulkUpdateProductPrices").mockResolvedValue({
      success: true,
      message: "Sale prices removed",
    });

    render(
      <BulkDiscountModal
        isOpen={true}
        onClose={vi.fn()}
        selectedProducts={mockSelectedProducts}
        onSuccess={handleSuccess}
        showToast={showToast}
        token="test-token"
      />,
    );

    // Switch to Remove Discount mode
    const removeTab = screen.getByRole("button", {
      name: /^إزالة الخصم$/,
    });
    fireEvent.click(removeTab);

    // Click Review & Remove Discount
    const reviewBtn = screen.getByRole("button", {
      name: /مراجعة وإزالة الخصم/,
    });
    fireEvent.click(reviewBtn);

    expect(
      await screen.findByText(/يرجى تأكيد التحديث الجماعي/),
    ).toBeInTheDocument();

    // Confirm execution
    const confirmBtn = screen.getByRole("button", {
      name: /تأكيد وإزالة الخصم/,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(discountsApi.bulkUpdateProductPrices).toHaveBeenCalledWith(
        "test-token",
        [
          { id: 10, price: 100, sale_price: null, sale_end: null },
          { id: 20, price: 200, sale_price: null, sale_end: null },
        ],
      );
    });
  });
});
