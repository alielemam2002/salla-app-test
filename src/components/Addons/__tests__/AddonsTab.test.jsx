import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddonsTab from "../AddonsTab.jsx";

function makeEmbedded(getAddonsResult) {
  return {
    checkout: {
      getAddons: vi.fn().mockResolvedValue(getAddonsResult),
      create: vi.fn(),
      onResult: vi.fn(() => () => {}),
    },
    nav: {
      setAction: vi.fn(),
      clearAction: vi.fn(),
      onActionClick: vi.fn(() => () => {}),
    },
  };
}

const ADDONS = [
  { slug: "sms-100", name: "100 SMS", price: 10, currency: "SAR" },
  { slug: "sms-500", name: "500 SMS", price: 40, currency: "SAR" },
];

describe("AddonsTab", () => {
  let logMessage;
  let showToast;

  beforeEach(() => {
    logMessage = vi.fn();
    showToast = vi.fn();
  });

  it("lists addons from checkout.getAddons()", async () => {
    const embedded = makeEmbedded({ success: true, addons: ADDONS });
    render(
      <AddonsTab
        embedded={embedded}
        logMessage={logMessage}
        showToast={showToast}
      />,
    );
    expect(await screen.findByText("100 SMS")).toBeInTheDocument();
    expect(screen.getByText("500 SMS")).toBeInTheDocument();
    expect(logMessage).toHaveBeenCalledWith("outgoing", {
      event: "embedded::checkout.getAddons",
    });
  });

  it("shows an error with retry when loading fails", async () => {
    const embedded = makeEmbedded({
      success: false,
      error: { message: "Boom" },
    });
    render(
      <AddonsTab
        embedded={embedded}
        logMessage={logMessage}
        showToast={showToast}
      />,
    );
    expect(await screen.findByText("Boom")).toBeInTheDocument();
    embedded.checkout.getAddons.mockResolvedValue({
      success: true,
      addons: ADDONS,
    });
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("100 SMS")).toBeInTheDocument();
  });

  it("shows an empty state when there are no addons", async () => {
    const embedded = makeEmbedded({ success: true, addons: [] });
    render(
      <AddonsTab
        embedded={embedded}
        logMessage={logMessage}
        showToast={showToast}
      />,
    );
    expect(await screen.findByText("No addons yet")).toBeInTheDocument();
  });

  it("buys a single addon via checkout.create", async () => {
    const embedded = makeEmbedded({ success: true, addons: ADDONS });
    render(
      <AddonsTab
        embedded={embedded}
        logMessage={logMessage}
        showToast={showToast}
      />,
    );
    await screen.findByText("100 SMS");
    await userEvent.click(screen.getAllByRole("button", { name: /^buy$/i })[0]);
    expect(embedded.checkout.create).toHaveBeenCalledWith(
      { type: "addon", slug: "sms-100", quantity: 1 },
      { context: { addonSlug: "sms-100" } },
    );
  });

  it("mirrors the selection into the navbar action and buys selected", async () => {
    const embedded = makeEmbedded({ success: true, addons: ADDONS });
    render(
      <AddonsTab
        embedded={embedded}
        logMessage={logMessage}
        showToast={showToast}
      />,
    );
    await screen.findByText("100 SMS");
    await userEvent.click(
      screen.getByRole("checkbox", { name: /select 100 sms/i }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: /select 500 sms/i }),
    );
    await waitFor(() =>
      expect(embedded.nav.setAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: "Buy Selected (2)" }),
      ),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /buy selected/i }),
    );
    expect(embedded.checkout.create).toHaveBeenCalledWith(
      [
        { type: "addon", slug: "sms-100", quantity: 1 },
        { type: "addon", slug: "sms-500", quantity: 1 },
      ],
      { context: { addonSlugs: ["sms-100", "sms-500"] } },
    );
  });
});
