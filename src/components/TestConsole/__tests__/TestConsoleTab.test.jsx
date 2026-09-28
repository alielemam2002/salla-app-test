import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TestConsoleTab from "../TestConsoleTab.jsx";
import { ToastProvider } from "../../../contexts/ToastContext.jsx";

function renderTab(overrides = {}) {
  const messageLog = {
    messageLog: [],
    filterUnknown: true,
    setFilterUnknown: vi.fn(),
    logMessage: vi.fn(),
    clearLog: vi.fn(),
    copyLog: vi.fn().mockResolvedValue(true),
  };
  const props = {
    embedded: { ready: vi.fn() },
    bootstrap: vi.fn(),
    layout: { theme: "light", width: 800 },
    token: null,
    verifiedData: null,
    verifyStatus: "verifying",
    messageLog,
    navSync: {},
    ...overrides,
  };
  render(
    <ToastProvider>
      <TestConsoleTab {...props} />
    </ToastProvider>,
  );
  return props;
}

describe("TestConsoleTab", () => {
  it("renders all console panels", () => {
    renderTab();
    expect(screen.getByText("Event Triggers")).toBeInTheDocument();
    expect(screen.getByText("Message Log")).toBeInTheDocument();
    expect(screen.getByText("Layout Data")).toBeInTheDocument();
    expect(screen.getByText("Payload Editor")).toBeInTheDocument();
    expect(screen.getByText("Verifying…")).toBeInTheDocument();
  });

  it("mirrors a clicked event into the payload editor", async () => {
    renderTab();
    await userEvent.click(screen.getByRole("button", { name: /^Ready/ }));
    expect(
      screen.getByRole("textbox", { name: /payload json/i }).value,
    ).toContain("embedded::ready");
  });
});
