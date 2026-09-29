import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AppLayout from "../AppLayout.jsx";
import { ThemeProvider } from "../../../contexts/ThemeContext.jsx";

const tabs = [{ id: "a", label: "Alpha" }];

function renderLayout(iframeMode) {
  return render(
    <ThemeProvider>
      <AppLayout
        connection={{ isConnected: false, parentOrigin: null, iframeMode }}
        tabs={tabs}
        activeTab="a"
        onTabChange={() => {}}
      >
        <p>Content</p>
      </AppLayout>
    </ThemeProvider>,
  );
}

describe("AppLayout", () => {
  it("shows the app header and connection strip when standalone", () => {
    renderLayout("standalone");
    expect(screen.getByText("مدير المتجر")).toBeInTheDocument();
    expect(screen.getByText("بانتظار لوحة سلة")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: "Alpha" })).toHaveTextContent(
      "Content",
    );
  });

  it("drops the header and connection strip inside the dashboard iframe (No-Chrome rule)", () => {
    renderLayout("iframe");
    expect(screen.queryByText("مدير المتجر")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Alpha" })).toBeInTheDocument();
  });
});
