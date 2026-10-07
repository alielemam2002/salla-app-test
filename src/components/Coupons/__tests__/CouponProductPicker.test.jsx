import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CouponProductPicker from "../CouponProductPicker.jsx";
import { fetchProductsPage } from "../../../utils/productsApi.js";

vi.mock("../../../utils/productsApi.js", () => ({
  fetchProductsPage: vi.fn(),
}));

describe("CouponProductPicker", () => {
  const getToken = () => "test-token";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search input when no product is selected", () => {
    render(
      <CouponProductPicker
        selectedIds={[]}
        selectedProduct={null}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        getToken={getToken}
      />
    );

    expect(
      screen.getByPlaceholderText("ابحث باسم المنتج أو رمزه (SKU)...")
    ).toBeInTheDocument();
  });

  it("searches and selects a product from dropdown", async () => {
    const onSelect = vi.fn();
    fetchProductsPage.mockResolvedValue({
      success: true,
      products: [
        {
          id: 555,
          name: "عطر فاخر",
          sku: "PERF-1",
          price: { amount: 150, currency: "SAR" },
        },
      ],
    });

    render(
      <CouponProductPicker
        selectedIds={[]}
        selectedProduct={null}
        onSelect={onSelect}
        onRemove={vi.fn()}
        getToken={getToken}
      />
    );

    const input = screen.getByPlaceholderText("ابحث باسم المنتج أو رمزه (SKU)...");
    fireEvent.change(input, { target: { value: "عطر" } });

    await waitFor(
      () => {
        expect(screen.getByText("عطر فاخر")).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    fireEvent.click(screen.getByText("عطر فاخر"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 555, name: "عطر فاخر" })
    );
  });

  it("allows entering a manual ID directly", () => {
    const onSelect = vi.fn();
    render(
      <CouponProductPicker
        selectedIds={[]}
        selectedProduct={null}
        onSelect={onSelect}
        onRemove={vi.fn()}
        getToken={getToken}
      />
    );

    fireEvent.click(screen.getByText(/أدخل رقم معرّف المنتج/));

    const idInput = screen.getByPlaceholderText(/رقم المنتج في سلة/);
    fireEvent.change(idInput, { target: { value: "789" } });
    fireEvent.click(screen.getByRole("button", { name: "اختيار" }));

    expect(onSelect).toHaveBeenCalledWith({ id: 789, name: "منتج #789" });
  });

  it("displays the selected product card and allows removal", () => {
    const onRemove = vi.fn();
    render(
      <CouponProductPicker
        selectedIds={[555]}
        selectedProduct={{
          id: 555,
          name: "عطر فاخر",
          sku: "PERF-1",
        }}
        onSelect={vi.fn()}
        onRemove={onRemove}
        getToken={getToken}
      />
    );

    expect(screen.getByText("عطر فاخر")).toBeInTheDocument();
    expect(screen.getByText(/ID: #555/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "تغيير المنتج" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("shows error message if provided", () => {
    render(
      <CouponProductPicker
        selectedIds={[]}
        selectedProduct={null}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        getToken={getToken}
        error="يرجى اختيار المنتج المراد تطبيق الخصم عليه"
      />
    );

    expect(
      screen.getByText("يرجى اختيار المنتج المراد تطبيق الخصم عليه")
    ).toBeInTheDocument();
  });
});
