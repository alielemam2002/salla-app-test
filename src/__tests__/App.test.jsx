import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.jsx";

const mockEmbedded = {
  init: vi.fn().mockResolvedValue({ layout: {} }),
  ready: vi.fn(),
  auth: { getToken: vi.fn().mockReturnValue(null) },
  page: {},
  nav: { onActionClick: vi.fn().mockReturnValue(() => {}) },
  destroy: vi.fn(),
  onThemeChange: vi.fn().mockReturnValue(() => {}),
  onInit: vi.fn().mockReturnValue(() => {}),
  ui: { toast: { error: vi.fn() }, loading: { show: vi.fn(), hide: vi.fn() } },
  checkout: { getAddons: vi.fn(), onResult: vi.fn().mockReturnValue(() => {}) },
};

vi.mock("../hooks/useAppBootstrap.js", () => ({
  useAppBootstrap: () => ({
    embedded: mockEmbedded,
    isReady: false,
    isInitializing: false,
    layout: null,
    token: null,
    verifiedData: null,
    verifyStatus: "idle",
    error: null,
    bootstrap: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe("App", () => {
  it("shows the merchant tabs in Arabic, without the developer tools", () => {
    render(<App />);
    for (const name of [
      "المنتجات",
      "الكوبونات",
      "السلات المتروكة",
      "حملات واتساب",
      "الإضافات",
    ]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("tab", { name: /Test Console/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Playground/ })).toBeNull();
  });

  it("opens on Products and switches tabs", async () => {
    render(<App />);
    expect(screen.getByRole("tab", { name: "المنتجات" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.click(screen.getByRole("tab", { name: "الكوبونات" }));
    expect(screen.getByRole("tab", { name: "الكوبونات" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
