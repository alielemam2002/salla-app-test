import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBar from "../StatusBar.jsx";

describe("StatusBar", () => {
  it("renders Connected when isConnected is true", () => {
    render(
      <StatusBar
        isConnected={true}
        parentOrigin="https://example.com"
        iframeMode="embedded"
      />,
    );
    expect(screen.getByText("متصل بسلة")).toBeInTheDocument();
    expect(screen.getByText("https://example.com")).toBeInTheDocument();
    expect(screen.getByText("embedded")).toBeInTheDocument();
  });

  it("renders Waiting for Parent when isConnected is false", () => {
    render(
      <StatusBar
        isConnected={false}
        parentOrigin={null}
        iframeMode="standalone"
      />,
    );
    expect(screen.getByText("بانتظار لوحة سلة")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("standalone")).toBeInTheDocument();
  });
});
