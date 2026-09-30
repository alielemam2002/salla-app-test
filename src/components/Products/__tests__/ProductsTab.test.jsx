import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProductsTab, { productImage } from "../ProductsTab.jsx";
import {
  fetchProductsPage,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchTaxonomies,
} from "../../../utils/productsApi.js";

vi.mock("../../../utils/productsApi.js", () => ({
  fetchProductsPage: vi.fn(),
  fetchAllProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  fetchTaxonomies: vi.fn(() =>
    Promise.resolve({
      success: true,
      categories: [{ id: 101, name: "Clothes" }],
      brands: [{ id: 201, name: "Nike" }],
    }),
  ),
}));

vi.mock("../../../utils/logger.js", () => ({
  default: { error: vi.fn(), warn: vi.fn() },
}));

const makeEmbedded = (token = "tok") => ({
  auth: { getToken: vi.fn(() => token), refresh: vi.fn() },
});

describe("ProductsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchTaxonomies.mockResolvedValue({
      success: true,
      categories: [{ id: 101, name: "Clothes" }],
      brands: [{ id: 201, name: "Nike" }],
    });
  });

  it("renders products from the first page", async () => {
    fetchProductsPage.mockResolvedValue({
      success: true,
      products: [
        {
          id: 11,
          name: "Blue Shirt",
          sku: "BS-1",
          price: { amount: 99, currency: "SAR" },
          quantity: 5,
          status: "sale",
        },
      ],
      pagination: { total: 1, totalPages: 1 },
    });

    render(<ProductsTab embedded={makeEmbedded()} showToast={vi.fn()} />);

    expect(await screen.findByText("Blue Shirt")).toBeInTheDocument();
    expect(screen.getByText("99 SAR")).toBeInTheDocument();
    expect(fetchProductsPage).toHaveBeenCalledWith("tok", {
      page: 1,
      perPage: 30,
      keyword: undefined,
      status: undefined,
    });
  });

  it("shows an error when there is no embedded token", async () => {
    render(<ProductsTab embedded={makeEmbedded(null)} showToast={vi.fn()} />);

    expect(
      await screen.findByText(/لم يتم العثور على رمز الجلسة/),
    ).toBeInTheDocument();
    expect(fetchProductsPage).not.toHaveBeenCalled();
  });

  it("offers a session refresh when the session is invalid", async () => {
    fetchProductsPage.mockResolvedValue({
      success: false,
      code: "session_invalid",
      error: "Invalid or expired session token",
    });
    const embedded = makeEmbedded();

    render(<ProductsTab embedded={embedded} showToast={vi.fn()} />);

    fireEvent.click(await screen.findByText("تحديث الجلسة"));
    expect(embedded.auth.refresh).toHaveBeenCalled();
  });

  it("shows the setup hint when the access token is not configured", async () => {
    fetchProductsPage.mockResolvedValue({
      success: false,
      code: "token_not_configured",
      error: "SALLA_ACCESS_TOKEN is not set",
    });

    render(<ProductsTab embedded={makeEmbedded()} showToast={vi.fn()} />);

    await waitFor(() =>
      expect(
        screen.getByText(/لم يتم ربط التطبيق بالمتجر بعد/),
      ).toBeInTheDocument(),
    );
  });

  it("performs search when keyword is submitted", async () => {
    fetchProductsPage.mockResolvedValue({
      success: true,
      products: [
        {
          id: 22,
          name: "Red Shoes",
          sku: "RS-99",
          price: 150,
          quantity: 2,
          status: "sale",
        },
      ],
      pagination: { total: 1, totalPages: 1 },
    });

    render(<ProductsTab embedded={makeEmbedded()} showToast={vi.fn()} />);
    await screen.findByText("Red Shoes");

    const searchInput = screen.getByPlaceholderText(/ابحث بالاسم أو رمز SKU/);
    fireEvent.change(searchInput, { target: { value: "Shoes" } });

    const searchButton = screen.getByRole("button", { name: "بحث" });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(fetchProductsPage).toHaveBeenCalledWith("tok", {
        page: 1,
        perPage: 30,
        keyword: "Shoes",
        status: undefined,
      });
    });
  });

  it("opens Add Product modal and submits new product", async () => {
    fetchProductsPage.mockResolvedValue({
      success: true,
      products: [],
      pagination: { total: 0, totalPages: 1 },
    });
    createProduct.mockResolvedValue({
      success: true,
      product: {
        id: 999,
        name: "New Summer Cap",
        price: 45,
        status: "sale",
        quantity: 10,
      },
    });

    const showToast = vi.fn();
    render(<ProductsTab embedded={makeEmbedded()} showToast={showToast} />);

    // Click Add Product button in header
    const addBtn = await screen.findByRole("button", { name: /إضافة منتج/ });
    fireEvent.click(addBtn);

    // Form modal should be open
    expect(
      screen.getByRole("heading", { name: "إضافة منتج" }),
    ).toBeInTheDocument();

    // Fill form
    const nameInput = screen.getByLabelText(/اسم المنتج/);
    fireEvent.change(nameInput, { target: { value: "New Summer Cap" } });

    const priceInput = screen.getByLabelText(/السعر \(SAR\)/);
    fireEvent.change(priceInput, { target: { value: "45" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: "إضافة المنتج" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createProduct).toHaveBeenCalledWith(
        "tok",
        expect.objectContaining({
          name: "New Summer Cap",
          price: 45,
          status: "sale",
        }),
      );
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("تمت إضافة المنتج"),
        "success",
      );
    });
  });

  it("opens Edit Product modal and updates product", async () => {
    fetchProductsPage.mockResolvedValue({
      success: true,
      products: [
        {
          id: 55,
          name: "Green Jacket",
          price: 200,
          quantity: 3,
          status: "sale",
        },
      ],
      pagination: { total: 1, totalPages: 1 },
    });
    updateProduct.mockResolvedValue({
      success: true,
      product: {
        id: 55,
        name: "Green Jacket Premium",
        price: 220,
        quantity: 3,
        status: "sale",
      },
    });

    const showToast = vi.fn();
    render(<ProductsTab embedded={makeEmbedded()} showToast={showToast} />);
    await screen.findByText("Green Jacket");

    // Click Edit button
    const editBtn = screen.getByTitle("تعديل Green Jacket");
    fireEvent.click(editBtn);

    // Form modal should be open with product details
    expect(
      screen.getByRole("heading", { name: /تعديل المنتج #55/ }),
    ).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/اسم المنتج/);
    expect(nameInput.value).toBe("Green Jacket");

    fireEvent.change(nameInput, { target: { value: "Green Jacket Premium" } });

    // Submit update
    const submitBtn = screen.getByRole("button", { name: "حفظ التعديلات" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateProduct).toHaveBeenCalledWith(
        "tok",
        55,
        expect.objectContaining({
          name: "Green Jacket Premium",
        }),
      );
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("تم تحديث المنتج"),
        "success",
      );
    });
  });

  it("opens Delete Confirmation dialog and deletes product", async () => {
    fetchProductsPage.mockResolvedValue({
      success: true,
      products: [
        {
          id: 77,
          name: "Old Item",
          price: 10,
          status: "out",
        },
      ],
      pagination: { total: 1, totalPages: 1 },
    });
    deleteProduct.mockResolvedValue({
      success: true,
      productId: 77,
    });

    const showToast = vi.fn();
    render(<ProductsTab embedded={makeEmbedded()} showToast={showToast} />);
    await screen.findByText("Old Item");

    // Click Delete icon
    const deleteIconBtn = screen.getByTitle("حذف Old Item");
    fireEvent.click(deleteIconBtn);

    // Confirmation dialog should be visible
    expect(
      screen.getByRole("heading", { name: "حذف المنتج" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/هل أنت متأكد من حذف هذا المنتج/),
    ).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = screen.getByRole("button", { name: "حذف المنتج" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteProduct).toHaveBeenCalledWith("tok", 77);
      expect(showToast).toHaveBeenCalledWith("تم حذف المنتج بنجاح", "success");
    });
  });

  it("selects products via checkboxes and opens Bulk Discount modal", async () => {
    fetchProductsPage.mockResolvedValue({
      success: true,
      products: [
        {
          id: 88,
          name: "Bulk Target Item",
          price: 150,
          status: "sale",
        },
      ],
      pagination: { total: 1, totalPages: 1 },
    });

    render(<ProductsTab embedded={makeEmbedded()} showToast={vi.fn()} />);
    await screen.findByText("Bulk Target Item");

    // Select row checkbox
    const rowCheckbox = screen.getByLabelText("تحديد Bulk Target Item");
    fireEvent.click(rowCheckbox);

    // Selection bar should appear with count
    expect(await screen.findByText(/منتج محدد/)).toBeInTheDocument();

    // Click Bulk Discount button
    const bulkDiscountBtns = screen.getAllByRole("button", {
      name: /خصم جماعي/,
    });
    fireEvent.click(bulkDiscountBtns[0]);

    // Bulk Discount Modal should be open
    expect(
      await screen.findByRole("heading", { name: "خصم جماعي على المنتجات" }),
    ).toBeInTheDocument();
  });

  it("displays regular price with strikethrough and sale price when product is on sale", async () => {
    fetchProductsPage.mockResolvedValue({
      success: true,
      products: [
        {
          id: 99,
          name: "Discounted Sneakers",
          regular_price: { amount: 200, currency: "SAR" },
          price: { amount: 150, currency: "SAR" },
          sale_price: { amount: 150, currency: "SAR" },
          status: "sale",
        },
      ],
      pagination: { total: 1, totalPages: 1 },
    });

    render(<ProductsTab embedded={makeEmbedded()} showToast={vi.fn()} />);
    await screen.findByText("Discounted Sneakers");

    expect(screen.getByText("200 SAR")).toBeInTheDocument();
    expect(screen.getByText("سعر التخفيض: 150 SAR")).toBeInTheDocument();
  });

  describe("productImage resolution", () => {
    it("prioritizes image with is_main: true over thumbnail", () => {
      const product = {
        thumbnail: "https://example.com/old_thumb.jpg",
        images: [
          { original: "https://example.com/img1.jpg", is_main: false },
          { original: "https://example.com/img2.jpg", is_main: true },
        ],
      };
      expect(productImage(product)).toBe("https://example.com/img2.jpg");
    });

    it("prioritizes image with default: true over thumbnail", () => {
      const product = {
        thumbnail: "https://example.com/old_thumb.jpg",
        images: [
          { url: "https://example.com/img1.jpg", default: false },
          { url: "https://example.com/img2.jpg", default: true },
        ],
      };
      expect(productImage(product)).toBe("https://example.com/img2.jpg");
    });

    it("prioritizes image with sort: 1 when no is_main/default flag is set", () => {
      const product = {
        thumbnail: "https://example.com/old_thumb.jpg",
        images: [
          { url: "https://example.com/img2.jpg", sort: 2 },
          { url: "https://example.com/img1.jpg", sort: 1 },
        ],
      };
      expect(productImage(product)).toBe("https://example.com/img1.jpg");
    });

    it("falls back to thumbnail when images array is empty", () => {
      const product = {
        thumbnail: "https://example.com/thumb.jpg",
        images: [],
      };
      expect(productImage(product)).toBe("https://example.com/thumb.jpg");
    });
  });
});
