import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Plus } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  IconButton,
  KeyValueList,
  SegmentedTabs,
  Switch,
} from "../index.js";
import ToastViewport from "../ToastViewport.jsx";

describe("Button loading/icon", () => {
  it("disables and marks busy while loading", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button", { name: /Save/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("defaults to type=button", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("IconButton", () => {
  it("uses the label as accessible name", async () => {
    const onClick = vi.fn();
    render(<IconButton icon={Plus} label="Add item" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(onClick).toHaveBeenCalled();
  });
});

describe("Badge / Alert / EmptyState", () => {
  it("applies the tone class", () => {
    render(<Badge tone="success">Paid</Badge>);
    expect(screen.getByText("Paid")).toHaveClass("ui-badge--success");
  });

  it("renders an error alert with role=alert", () => {
    render(
      <Alert tone="error" title="Failed">
        Details
      </Alert>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("FailedDetails");
  });

  it("renders the empty state action", () => {
    render(<EmptyState title="Nothing here" action={<button>Retry</button>} />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("Switch", () => {
  it("toggles with role=switch", async () => {
    const onChange = vi.fn();
    render(<Switch label="Unlimited" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole("switch", { name: "Unlimited" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("KeyValueList", () => {
  it("renders labels and falls back to a dash", () => {
    render(
      <KeyValueList
        items={[
          { label: "Theme", value: "dark" },
          { label: "Locale", value: null },
        ]}
      />,
    );
    expect(screen.getByText("dark")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("SegmentedTabs", () => {
  it("marks the active tab and reports changes", async () => {
    const onTabChange = vi.fn();
    render(
      <SegmentedTabs
        tabs={[
          { id: "a", label: "A" },
          { id: "b", label: "B", badge: 3 },
        ]}
        activeTab="a"
        onTabChange={onTabChange}
      />,
    );
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.click(screen.getByRole("tab", { name: /B/ }));
    expect(onTabChange).toHaveBeenCalledWith("b");
  });
});

describe("ToastViewport", () => {
  it("renders toasts and dismisses on click", async () => {
    const onDismiss = vi.fn();
    render(
      <ToastViewport
        toasts={[
          { id: 1, message: "Saved", type: "success" },
          { id: 2, message: "Oops", type: "error" },
        ]}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Oops");
    await userEvent.click(screen.getByText("Saved"));
    expect(onDismiss).toHaveBeenCalledWith(1);
  });
});
