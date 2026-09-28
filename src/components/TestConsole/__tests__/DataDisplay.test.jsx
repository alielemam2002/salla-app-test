import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DataDisplay from "../DataDisplay.jsx";

describe("DataDisplay", () => {
  it("renders Layout Data panel", () => {
    render(
      <DataDisplay
        layoutData={null}
        token={null}
        verifiedData={null}
        verifyStatus="idle"
      />,
    );
    expect(screen.getByText("Layout Data")).toBeInTheDocument();
  });

  it("displays layoutData theme and width", () => {
    render(
      <DataDisplay
        layoutData={{ theme: "dark", width: 400 }}
        token={null}
        verifiedData={null}
        verifyStatus="idle"
      />,
    );
    expect(screen.getByText("dark")).toBeInTheDocument();
    expect(screen.getByText("400px")).toBeInTheDocument();
  });

  it("maps raw verifyStatus to a readable label", () => {
    const { rerender } = render(
      <DataDisplay
        layoutData={null}
        token={null}
        verifiedData={null}
        verifyStatus="verified"
      />,
    );
    expect(screen.getByText("Verified")).toBeInTheDocument();

    rerender(
      <DataDisplay
        layoutData={null}
        token={null}
        verifiedData={null}
        verifyStatus="failed"
      />,
    );
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("displays token (masked when long)", () => {
    render(
      <DataDisplay
        layoutData={null}
        token="short"
        verifiedData={null}
        verifyStatus="idle"
      />,
    );
    expect(screen.getByText("short")).toBeInTheDocument();
  });
});
