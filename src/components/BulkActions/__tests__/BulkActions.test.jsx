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
  fireEvent.click(screen.getByRole("button", { name: /More/ }));
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
    fireEvent.click(await screen.findByLabelText("Select Shoe A"));
    fireEvent.click(screen.getByLabelText("Select Shoe B"));
    openAction("Edit Price");

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Value/), {
      target: { value: "20" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Review changes" }),
    );

    const table = await within(dialog).findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows[0]).toHaveTextContent(
      "ProductPriceSale Price nowNew sale price",
    );
    expect(rows[1]).toHaveTextContent("Shoe A100—80 SAR");
    expect(rows[2]).toHaveTextContent("Shoe B250—200 SAR");
    expect(executeBulkProductAction).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm & Apply" }),
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
      await within(dialog).findByText("Bulk operation started"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("op-123")).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(
      "Bulk operation started: 2 products are being processed by Salla.",
      "success",
    );
    // Selection is cleared; the operation is logged as still processing.
    expect(screen.queryByRole("region", { name: "Selection" })).toBeNull();
    const panel = screen.getByRole("region", { name: "Bulk Operations" });
    expect(within(panel).getByText("Processing in Salla")).toBeInTheDocument();
    expect(within(panel).getByText("op-123")).toBeInTheDocument();
  });

  it("selects all matching products through Salla filters, minus unticked ones", async () => {
    executeBulkProductAction.mockResolvedValue({
      success: true,
      operations: [],
    });
    renderTab({ total: 124 });
    await screen.findByText("Shoe A");
    fireEvent.change(screen.getByLabelText("Filter by status"), {
      target: { value: "sale" },
    });
    await waitFor(() =>
      expect(fetchProductsPage.mock.calls.length).toBeGreaterThanOrEqual(2),
    );
    await screen.findByText("Shoe A");

    fireEvent.click(screen.getByLabelText("Select all on this page"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Select all 124 matching" }),
    );
    fireEvent.click(screen.getByLabelText("Select Shoe B"));
    expect(screen.getByText("123")).toBeInTheDocument();

    openMore("Duplicate");
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("You are about to duplicate 123 products."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Status: Active \(Sale\)/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("+122 more products")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Duplicate" }));
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
    fireEvent.click(await screen.findByLabelText("Select Shoe A"));
    openAction("Edit Price");
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Change"), {
      target: { value: "price_minus_amount" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Value/), {
      target: { value: "150" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Review changes" }),
    );

    expect(
      await within(dialog).findByText("New price cannot be negative"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Confirm & Apply" }),
    ).toBeDisabled();
  });

  it("validates forms before review", async () => {
    renderTab();
    fireEvent.click(await screen.findByLabelText("Select Shoe A"));
    openMore("Stock Notification");
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Review changes" }),
    );
    expect(
      await within(dialog).findByText("Notify quantity is required"),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/^Notify quantity/), {
      target: { value: "10" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Minimum notify quantity/), {
      target: { value: "20" },
    });
    fireEvent.change(within(dialog).getByLabelText(/Subscribers percentage/), {
      target: { value: "150" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Review changes" }),
    );
    expect(
      await within(dialog).findByText("Subscribers percentage is at most 100"),
    ).toBeInTheDocument();
  });

  it("sets tags by id with the features action", async () => {
    executeBulkProductAction.mockResolvedValue({
      success: true,
      operations: [],
    });
    renderTab();
    fireEvent.click(await screen.findByLabelText("Select Shoe A"));
    openAction("Tags");
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText("Summer"));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Review changes" }),
    );
    expect(await within(dialog).findByText("Tags: Summer")).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Confirm & Apply" }),
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
    fireEvent.click(await screen.findByLabelText("Select Shoe A"));
    openMore("Sale Channels");
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Review changes" }),
    );
    fireEvent.click(
      await within(dialog).findByRole("button", { name: "Confirm & Apply" }),
    );
    expect(
      await within(dialog).findByText(
        "Salla rejected the requested settings for this action.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Technical details")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Bulk Operations" }),
    ).toBeNull();
  });

  it("doesn't offer select-all across pages for a text search", async () => {
    renderTab({ total: 124 });
    await screen.findByText("Shoe A");
    fireEvent.change(screen.getByLabelText("Search products"), {
      target: { value: "shoe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() =>
      expect(fetchProductsPage.mock.calls.length).toBeGreaterThanOrEqual(2),
    );
    await screen.findByText("Shoe A");
    fireEvent.click(screen.getByLabelText("Select all on this page"));
    expect(await screen.findByText(/no text search/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /matching/ })).toBeNull();
  });
});
