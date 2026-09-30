import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProductsTab from "../../Products/ProductsTab.jsx";
import {
  fetchProductsPage,
  fetchTaxonomies,
} from "../../../utils/productsApi.js";
import { executeBulkProductAction } from "../../../utils/bulkActions/bulkActionsApi.js";
import { resetOperationsCache } from "../../../utils/bulkActions/bulkOperationsLog.js";

vi.mock("../../../utils/productsApi.js", () => ({
  fetchProductsPage: vi.fn(),
  fetchAllProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  fetchTaxonomies: vi.fn(),
}));

vi.mock("../../../utils/bulkActions/bulkActionsApi.js", () => ({
  executeBulkProductAction: vi.fn(),
}));

vi.mock("../../../utils/logger.js", () => ({
  default: { error: vi.fn(), warn: vi.fn() },
}));

const PRODUCTS = [
  {
    id: 1,
    name: "Shoe A",
    price: { amount: 100, currency: "SAR" },
    status: "sale",
  },
  {
    id: 2,
    name: "Shoe B",
    price: { amount: 250, currency: "SAR" },
    status: "sale",
  },
];

const makeEmbedded = () => ({
  auth: { getToken: vi.fn(() => "tok"), refresh: vi.fn() },
});

function renderTab({ total = 2 } = {}) {
  fetchProductsPage.mockResolvedValue({
    success: true,
    products: PRODUCTS,
    pagination: { total, totalPages: Math.ceil(total / 30) },
  });
  const showToast = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ProductsTab embedded={makeEmbedded()} showToast={showToast} />
    </QueryClientProvider>,
  );
  return { showToast };
}

const openAction = (name) =>
  fireEvent.click(screen.getByRole("button", { name }));

const openMore = (name) => {
  fireEvent.click(screen.getByRole("button", { name: /المزيد/ }));
  fireEvent.click(screen.getByRole("menuitem", { name }));
};

describe("Bulk product actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    resetOperationsCache();
    fetchTaxonomies.mockResolvedValue({
      success: true,
      categories: [{ id: 77, name: "Shoes" }],
      brands: [{ id: 5, name: "Nike" }],
      tags: [{ id: 9, name: "Summer" }],
    });
  });

  it("previews a price change, then submits it for the chosen ids", async () => {
    executeBulkProductAction.mockResolvedValue({
      success: true,
      operations: [
        {
          operation_id: "op-123",
          action_name: "pricing",
          status: "in_progress",
        },
      ],
    });
    const { showToast } = renderTab();
    fireEvent.click(await screen.findByLabelText("تحديد Shoe A"));
    fireEvent.click(screen.getByLabelText("تحديد Shoe B"));
    openAction("تعديل السعر");

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/القيمة/), {
      target: { value: "20" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "مراجعة التغييرات" }),
    );

    const table = await within(dialog).findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows[0]).toHaveTextContent(
      "المنتجالسعرسعر التخفيض الحاليسعر التخفيض الجديد",
    );
    expect(rows[1]).toHaveTextContent("Shoe A100—80 SAR");
    expect(rows[2]).toHaveTextContent("Shoe B250—200 SAR");
    expect(executeBulkProductAction).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "تأكيد وتطبيق" }),
    );
    await waitFor(() =>
      expect(executeBulkProductAction).toHaveBeenCalledWith({
        token: "tok",
        actionName: "pricing",
        value: {
          column: "sale_price",
          formulaId: "price_minus_percent",
          amount: 20,
          apply_on: "product",
        },
        selection: { mode: "ids", ids: [1, 2] },
      }),
    );

    expect(
      await within(dialog).findByText("بدأت العملية الجماعية"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("op-123")).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(
      "بدأت العملية الجماعية: تتم معالجة 2 منتج في سلة.",
      "success",
    );
    // Selection is cleared; the operation is logged as still processing.
    expect(screen.queryByRole("region", { name: "التحديد" })).toBeNull();
    const panel = screen.getByRole("region", { name: "العمليات الجماعية" });
    expect(within(panel).getByText("قيد المعالجة في سلة")).toBeInTheDocument();
    expect(within(panel).getByText("op-123")).toBeInTheDocument();
  });

  it("selects all matching products through Salla filters, minus unticked ones", async () => {
    executeBulkProductAction.mockResolvedValue({
      success: true,
      operations: [],
    });
    renderTab({ total: 124 });
    await screen.findByText("Shoe A");
    fireEvent.change(screen.getByLabelText("تصفية حسب الحالة"), {
      target: { value: "sale" },
    });
    await waitFor(() =>
      expect(fetchProductsPage.mock.calls.length).toBeGreaterThanOrEqual(2),
    );
    await screen.findByText("Shoe A");

    fireEvent.click(screen.getByLabelText("تحديد كل منتجات هذه الصفحة"));
    fireEvent.click(
      await screen.findByRole("button", {
        name: "تحديد كل المنتجات المطابقة (124)",
      }),
    );
    fireEvent.click(screen.getByLabelText("تحديد Shoe B"));
    expect(screen.getByText("123")).toBeInTheDocument();

    openMore("تكرار");
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("أنت على وشك تكرار 123 منتج."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/الحالة: نشط/)).toBeInTheDocument();
    expect(within(dialog).getByText("+122 منتج آخر")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "تكرار" }));
    await waitFor(() =>
      expect(executeBulkProductAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actionName: "duplicate",
          selection: {
            mode: "all",
            excludedIds: [2],
            status: "sale",
            categoryId: "",
          },
        }),
      ),
    );
  });

  it("blocks prices that would go to zero or below", async () => {
    renderTab();
    fireEvent.click(await screen.findByLabelText("تحديد Shoe A"));
    openAction("تعديل السعر");
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("التغيير"), {
      target: { value: "price_minus_amount" },
    });
    fireEvent.change(within(dialog).getByLabelText(/القيمة/), {
      target: { value: "150" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "مراجعة التغييرات" }),
    );

    expect(
      await within(dialog).findByText("لا يمكن أن يكون السعر الجديد سالبًا"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "تأكيد وتطبيق" }),
    ).toBeDisabled();
  });

  it("validates forms before review", async () => {
    renderTab();
    fireEvent.click(await screen.findByLabelText("تحديد Shoe A"));
    openMore("تنبيه المخزون");
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "مراجعة التغييرات" }),
    );
    expect(
      await within(dialog).findByText("كمية التنبيه مطلوب"),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/^كمية التنبيه/), {
      target: { value: "10" },
    });
    fireEvent.change(
      within(dialog).getByLabelText(/الحد الأدنى لكمية التنبيه/),
      {
        target: { value: "20" },
      },
    );
    fireEvent.change(within(dialog).getByLabelText(/نسبة المشتركين/), {
      target: { value: "150" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "مراجعة التغييرات" }),
    );
    expect(
      await within(dialog).findByText("نسبة المشتركين لا يزيد عن 100"),
    ).toBeInTheDocument();
  });

  it("sets tags by id with the features action", async () => {
    executeBulkProductAction.mockResolvedValue({
      success: true,
      operations: [],
    });
    renderTab();
    fireEvent.click(await screen.findByLabelText("تحديد Shoe A"));
    openAction("الوسوم");
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText("Summer"));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "مراجعة التغييرات" }),
    );
    expect(
      await within(dialog).findByText("الوسوم: Summer"),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "تأكيد وتطبيق" }),
    );
    await waitFor(() =>
      expect(executeBulkProductAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actionName: "features",
          value: { tags: ["9"] },
          selection: { mode: "ids", ids: [1] },
        }),
      ),
    );
  });

  it("explains a Salla rejection without showing the raw error first", async () => {
    executeBulkProductAction.mockResolvedValue({
      success: false,
      status: 422,
      code: "salla_api_error",
      error: "alert.invalid_fields",
      fields: { "operations.0.value.channels": ["invalid"] },
    });
    renderTab();
    fireEvent.click(await screen.findByLabelText("تحديد Shoe A"));
    openMore("قنوات البيع");
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "مراجعة التغييرات" }),
    );
    fireEvent.click(
      await within(dialog).findByRole("button", { name: "تأكيد وتطبيق" }),
    );
    expect(
      await within(dialog).findByText(
        "رفضت سلة الإعدادات المطلوبة لهذا الإجراء.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("تفاصيل تقنية")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "العمليات الجماعية" }),
    ).toBeNull();
  });

  it("doesn't offer select-all across pages for a text search", async () => {
    renderTab({ total: 124 });
    await screen.findByText("Shoe A");
    fireEvent.change(screen.getByLabelText("بحث في المنتجات"), {
      target: { value: "shoe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "بحث" }));
    await waitFor(() =>
      expect(fetchProductsPage.mock.calls.length).toBeGreaterThanOrEqual(2),
    );
    await screen.findByText("Shoe A");
    fireEvent.click(screen.getByLabelText("تحديد كل منتجات هذه الصفحة"));
    expect(await screen.findByText(/لا تدعم البحث بالنص/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /المطابقة/ })).toBeNull();
  });
});
