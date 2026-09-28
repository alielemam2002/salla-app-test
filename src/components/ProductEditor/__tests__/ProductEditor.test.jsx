import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProductEditor from "../ProductEditor.jsx";
import * as productQueries from "../../../hooks/useProductQueries.js";

// Mock the hook modules
vi.mock("../../../hooks/useProductQueries.js");

const mockProduct = {
  id: 101,
  name: "Classic Silk Shirt",
  description: "A luxury silk shirt with mother-of-pearl buttons.",
  regular_price: 250,
  price: 199,
  sale_price: 199,
  cost_price: 80,
  quantity: 15,
  unlimited_quantity: false,
  sku: "SILK-001",
  gtin: "1234567890123",
  mpn: "MPN-SILK-1",
  promotion_title: "Summer Luxury Sale",
  subtitle: "Pure Mulberry Silk",
  metadata_title: "Buy Silk Shirt Online - Best Luxury Wear",
  metadata_description: "Discover our premium mulberry silk shirt. Free delivery.",
  metadata_url: "classic-silk-shirt",
  tags: ["silk", "luxury", "shirt"],
  images: [
    {
      id: 1,
      url: "https://example.com/silk-main.jpg",
      original: "https://example.com/silk-main.jpg",
      is_main: true,
      default: true,
      sort: 1,
    },
    {
      id: 2,
      url: "https://example.com/silk-side.jpg",
      original: "https://example.com/silk-side.jpg",
      is_main: false,
      sort: 2,
    },
  ],
  categories: [{ id: 10, name: "Fashion" }],
  brand: { id: 20, name: "SilkCo" },
  options: [
    {
      id: 501,
      name: "Size",
      values: [{ id: 1, name: "Small" }, { id: 2, name: "Medium" }],
    },
  ],
  variants: [
    {
      id: 901,
      sku: "SILK-001-S",
      price: 199,
      regular_price: 250,
      quantity: 5,
    },
  ],
};

function renderWithClient(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe("ProductEditor", () => {
  let mockMutateUpdateProduct;
  let mockMutateUploadImage;
  let mockMutateDeleteImage;
  let mockMutateCreateOption;
  let mockMutateDeleteOption;
  let mockMutateUpdateVariant;

  beforeEach(() => {
    vi.clearAllMocks();

    mockMutateUpdateProduct = vi.fn().mockResolvedValue({ success: true, product: mockProduct });
    mockMutateUploadImage = vi.fn().mockResolvedValue({ success: true });
    mockMutateDeleteImage = vi.fn().mockResolvedValue({ success: true });
    mockMutateCreateOption = vi.fn().mockResolvedValue({ success: true });
    mockMutateDeleteOption = vi.fn().mockResolvedValue({ success: true });
    mockMutateUpdateVariant = vi.fn().mockResolvedValue({ success: true });

    productQueries.useProduct.mockReturnValue({
      data: mockProduct,
      isLoading: false,
      refetch: vi.fn(),
      isRefetching: false,
    });

    productQueries.useTaxonomies.mockReturnValue({
      data: {
        categories: [
          { id: 10, name: "Fashion" },
          { id: 11, name: "Shoes" },
        ],
        brands: [
          { id: 20, name: "SilkCo" },
          { id: 21, name: "Zara" },
        ],
      },
      isLoading: false,
    });

    productQueries.useProductOptions.mockReturnValue({
      data: mockProduct.options,
      isLoading: false,
      refetch: vi.fn(),
    });

    productQueries.useProductVariants.mockReturnValue({
      data: mockProduct.variants,
      isLoading: false,
      refetch: vi.fn(),
    });

    productQueries.useProductImages.mockReturnValue({
      data: mockProduct.images,
      isLoading: false,
    });

    productQueries.useUpdateProduct.mockReturnValue({
      mutateAsync: mockMutateUpdateProduct,
      isPending: false,
    });

    productQueries.useUploadProductImage.mockReturnValue({
      mutateAsync: mockMutateUploadImage,
      isPending: false,
    });

    productQueries.useDeleteProductImage.mockReturnValue({
      mutateAsync: mockMutateDeleteImage,
      isPending: false,
    });

    productQueries.useCreateOption.mockReturnValue({
      mutateAsync: mockMutateCreateOption,
      isPending: false,
    });

    productQueries.useDeleteOption.mockReturnValue({
      mutateAsync: mockMutateDeleteOption,
      isPending: false,
    });

    productQueries.useUpdateVariant.mockReturnValue({
      mutateAsync: mockMutateUpdateVariant,
      isPending: false,
    });
  });

  it("renders ProductEditor with all 5 sections and dynamic completion card", async () => {
    const onBack = vi.fn();
    const showToast = vi.fn();

    renderWithClient(
      <ProductEditor
        productId={101}
        token="tok_test"
        initialProduct={mockProduct}
        onBack={onBack}
        showToast={showToast}
      />
    );

    // Header title and product id
    expect(screen.getByText("Classic Silk Shirt")).toBeInTheDocument();
    expect(screen.getByText(/#101/)).toBeInTheDocument();

    // Completion Card
    expect(screen.getByText("كمّل بيانات منتجك")).toBeInTheDocument();
    expect(screen.getAllByText("100%").length).toBeGreaterThan(0);

    // Section 1: Basic Info
    expect(screen.getAllByText("المعلومات الأساسية").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Classic Silk Shirt")).toBeInTheDocument();

    // Section 2: Appearance
    expect(screen.getAllByText("المظهر والصور").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Summer Luxury Sale")).toBeInTheDocument();

    // Section 3: SEO
    expect(screen.getAllByText("محركات البحث SEO").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Buy Silk Shirt Online - Best Luxury Wear")).toBeInTheDocument();

    // Section 4: Pricing & Inventory
    expect(screen.getAllByText("السعر والمخزون").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("SILK-001")).toBeInTheDocument();

    // Section 5: Options & Variants
    expect(screen.getAllByText(/الخيارات والمتغيرات/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Size")).toBeInTheDocument();
    expect(screen.getByText("SILK-001-S")).toBeInTheDocument();
  });

  it("calculates partial score when fields are missing", async () => {
    const partialProduct = {
      id: 102,
      name: "Simple Tee",
      regular_price: 50,
      quantity: 1,
      // No description, no brand, no images, no SEO, no variants
    };

    productQueries.useProduct.mockReturnValue({
      data: partialProduct,
      isLoading: false,
      refetch: vi.fn(),
    });
    productQueries.useProductOptions.mockReturnValue({ data: [], isLoading: false });
    productQueries.useProductVariants.mockReturnValue({ data: [], isLoading: false });
    productQueries.useProductImages.mockReturnValue({ data: [], isLoading: false });

    renderWithClient(
      <ProductEditor
        productId={102}
        token="tok_test"
        initialProduct={partialProduct}
        onBack={vi.fn()}
      />
    );

    // Score should be less than 100%
    expect(screen.getByText("كمّل بيانات منتجك")).toBeInTheDocument();
    // Missing items indicator should appear
    expect(screen.getAllByText(/ينقصك/i).length).toBeGreaterThan(0);
  });

  it("updates completion score in real-time when user types into a missing field", async () => {
    const incompleteProduct = {
      id: 103,
      name: "Tee Without Description",
      regular_price: 30,
      quantity: 10,
    };

    productQueries.useProduct.mockReturnValue({
      data: incompleteProduct,
      isLoading: false,
      refetch: vi.fn(),
    });
    productQueries.useProductOptions.mockReturnValue({ data: [], isLoading: false });
    productQueries.useProductVariants.mockReturnValue({ data: [], isLoading: false });
    productQueries.useProductImages.mockReturnValue({ data: [], isLoading: false });

    renderWithClient(
      <ProductEditor
        productId={103}
        token="tok_test"
        initialProduct={incompleteProduct}
        onBack={vi.fn()}
      />
    );

    // Description is empty
    const descTextarea = screen.getByPlaceholderText(/أدخل وصفًا تفصيليًا وجذابًا/i);
    expect(descTextarea.value).toBe("");

    // Type a description
    fireEvent.change(descTextarea, {
      target: { value: "Now this product has a rich description!" },
    });

    expect(descTextarea.value).toBe("Now this product has a rich description!");
  });

  it("triggers section save when section save button is clicked", async () => {
    const showToast = vi.fn();
    renderWithClient(
      <ProductEditor
        productId={101}
        token="tok_test"
        initialProduct={mockProduct}
        onBack={vi.fn()}
        showToast={showToast}
      />
    );

    // Change promotional title in Appearance section
    const promoInput = screen.getByDisplayValue("Summer Luxury Sale");
    fireEvent.change(promoInput, { target: { value: "Flash Sale 50% Off" } });

    // Click "حفظ المظهر" in the Appearance section
    const appearanceSaveBtn = screen.getByRole("button", { name: /حفظ المظهر/i });
    fireEvent.click(appearanceSaveBtn);

    await waitFor(() => {
      expect(mockMutateUpdateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          promotion_title: "Flash Sale 50% Off",
        })
      );
    });
  });

  it("triggers master save when bottom bar save button is clicked", async () => {
    const showToast = vi.fn();
    renderWithClient(
      <ProductEditor
        productId={101}
        token="tok_test"
        initialProduct={mockProduct}
        onBack={vi.fn()}
        showToast={showToast}
      />
    );

    // Click master save in bottom bar
    const masterSaveBtn = screen.getByRole("button", { name: /حفظ جميع البيانات/i });
    fireEvent.click(masterSaveBtn);

    await waitFor(() => {
      expect(mockMutateUpdateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Classic Silk Shirt",
          price: 250,
          sale_price: 199,
          sku: "SILK-001",
          quantity: 15,
          tags: [{ name: "silk" }, { name: "luxury" }, { name: "shirt" }],
        })
      );
      // Not part of Salla's PUT /products/{id} body
      expect(mockMutateUpdateProduct.mock.calls[0][0]).not.toHaveProperty(
        "regular_price",
      );
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("تم حفظ بيانات المنتج بنجاح"),
        "success"
      );
    });
  });

  it("renders the editor right-to-left", () => {
    const { container } = renderWithClient(
      <ProductEditor
        productId={101}
        token="tok_test"
        initialProduct={mockProduct}
        onBack={vi.fn()}
      />
    );
    const root = container.querySelector(".product-editor-container");
    expect(root).toHaveAttribute("dir", "rtl");
    expect(root).toHaveAttribute("lang", "ar");
  });

  it("does not send quantity when stock is unlimited", async () => {
    const product = { ...mockProduct, unlimited_quantity: true };
    productQueries.useProduct.mockReturnValue({
      data: product,
      isLoading: false,
      refetch: vi.fn(),
      isRefetching: false,
    });
    renderWithClient(
      <ProductEditor
        productId={101}
        token="tok_test"
        initialProduct={product}
        onBack={vi.fn()}
        showToast={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /حفظ جميع البيانات/i }));
    await waitFor(() => expect(mockMutateUpdateProduct).toHaveBeenCalled());
    const payload = mockMutateUpdateProduct.mock.calls.at(-1)[0];
    expect(payload.unlimited_quantity).toBe(true);
    expect(payload).not.toHaveProperty("quantity");
  });

  it("blocks saving when the sale price is not below the regular price", async () => {
    const product = { ...mockProduct, sale_price: 300 };
    productQueries.useProduct.mockReturnValue({
      data: product,
      isLoading: false,
      refetch: vi.fn(),
      isRefetching: false,
    });
    renderWithClient(
      <ProductEditor
        productId={101}
        token="tok_test"
        initialProduct={product}
        onBack={vi.fn()}
        showToast={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /حفظ جميع البيانات/i }));
    expect(
      await screen.findByText("سعر التخفيض يجب أن يكون أقل من السعر الأساسي"),
    ).toBeInTheDocument();
    expect(mockMutateUpdateProduct).not.toHaveBeenCalled();
  });

  it("calls onBack when back button is clicked", () => {
    const onBack = vi.fn();
    renderWithClient(
      <ProductEditor
        productId={101}
        token="tok_test"
        initialProduct={mockProduct}
        onBack={onBack}
      />
    );

    const backBtn = screen.getByRole("button", { name: /العودة لقائمة المنتجات/i });
    fireEvent.click(backBtn);

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
