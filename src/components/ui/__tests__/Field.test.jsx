import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field, Select, TextInput, Textarea } from "../Field.jsx";

describe("Field", () => {
  it("links the label to the control", () => {
    render(
      <Field label="Name" required>
        <TextInput />
      </Field>,
    );
    const input = screen.getByLabelText(/Name/);
    expect(input).toHaveClass("form-input");
    expect(screen.getByText("*")).toHaveClass("form-required");
  });

  it("shows the hint and describes the control with it", () => {
    render(
      <Field label="SKU" hint="Unique code">
        <TextInput />
      </Field>,
    );
    const input = screen.getByLabelText("SKU");
    const hint = screen.getByText("Unique code");
    expect(input).toHaveAttribute("aria-describedby", hint.id);
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("prefers the error over the hint and marks the control invalid", () => {
    render(
      <Field label="Price" hint="In SAR" error="Required">
        <TextInput invalid />
      </Field>,
    );
    const input = screen.getByLabelText("Price");
    expect(screen.getByText("Required")).toHaveClass("form-error-msg");
    expect(screen.queryByText("In SAR")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveClass("form-input--error");
  });

  it("keeps an explicit control id", () => {
    render(
      <Field label="Notes">
        <Textarea id="notes" />
      </Field>,
    );
    expect(screen.getByLabelText("Notes")).toHaveAttribute("id", "notes");
  });

  it("renders select options and placeholder", () => {
    render(
      <Field label="Status">
        <Select
          placeholder="Choose"
          options={[
            { value: "a", label: "Active" },
            { value: "b", label: "Hidden" },
          ]}
        />
      </Field>,
    );
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByRole("option", { name: "Hidden" })).toHaveValue("b");
  });

  it("renders input affixes", () => {
    render(<TextInput aria-label="Amount" prefix="SAR" suffix="%" />);
    expect(screen.getByText("SAR")).toBeInTheDocument();
    expect(screen.getByText("%")).toBeInTheDocument();
  });
});
