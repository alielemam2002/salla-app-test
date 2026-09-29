import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "../Header.jsx";
import { ThemeProvider } from "../../../contexts/ThemeContext.jsx";

describe("Header", () => {
  it("renders the Arabic title", () => {
    render(
      <ThemeProvider>
        <Header />
      </ThemeProvider>,
    );
    expect(screen.getByText("مدير المتجر")).toBeInTheDocument();
  });

  it("renders theme toggle button", () => {
    render(
      <ThemeProvider>
        <Header />
      </ThemeProvider>,
    );
    expect(
      screen.getByRole("button", { name: "تبديل المظهر" }),
    ).toBeInTheDocument();
  });

  it("toggles theme when theme button is clicked", async () => {
    render(
      <ThemeProvider>
        <Header />
      </ThemeProvider>,
    );
    const toggle = screen.getByRole("button", { name: "تبديل المظهر" });
    await userEvent.click(toggle);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
