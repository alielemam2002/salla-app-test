import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "../Modal.jsx";
import ConfirmDialog from "../ConfirmDialog.jsx";

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Hidden">
        Body
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders a labelled dialog with body and footer", () => {
    render(
      <Modal
        isOpen
        onClose={() => {}}
        title="Edit"
        subtitle="Sub"
        footer={<button>Save</button>}
      >
        Body text
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByText("Sub")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("closes on Escape, close button and backdrop click", async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="T">
        Body
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    await userEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    await userEvent.click(document.querySelector(".modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("does not close when not dismissible", async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="T" dismissible={false}>
        Body
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    await userEvent.click(document.querySelector(".modal-backdrop"));
    expect(screen.getByRole("button", { name: "إغلاق" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close when clicking inside the dialog", async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="T">
        Inside
      </Modal>,
    );
    await userEvent.click(screen.getByText("Inside"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ConfirmDialog", () => {
  it("calls onConfirm and shows loading text", async () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ConfirmDialog
        isOpen
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Delete?"
        confirmText="Delete"
        loadingText="Deleting..."
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalled();

    rerender(
      <ConfirmDialog
        isOpen
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Delete?"
        confirmText="Delete"
        loadingText="Deleting..."
        loading
      />,
    );
    expect(screen.getByRole("button", { name: /Deleting/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "إلغاء" })).toBeDisabled();
  });
});
