import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProductsTab from "../ProductsTab.jsx";
import { fetchProductsPage } from "../../../utils/productsApi.js";

vi.mock("../../../utils/productsApi.js", () => ({
  fetchProductsPage: vi.fn(),
  fetchAllProducts: vi.fn(),
}));

vi.mock("../../../utils/logger.js", () => ({
  default: { error: vi.fn() },
}));

const makeEmbedded = (token = "tok") => ({
  auth: { getToken: vi.fn(() => token), refresh: vi.fn() },
});

describe("ProductsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    });
  });

  it("shows an error when there is no embedded token", async () => {
    render(<ProductsTab embedded={makeEmbedded(null)} showToast={vi.fn()} />);

    expect(
      await screen.findByText(/No embedded token found/),
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

    fireEvent.click(await screen.findByText("Refresh session"));
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
        screen.getByText(/Add the store's Merchant API access token/),
      ).toBeInTheDocument(),
    );
  });
});
