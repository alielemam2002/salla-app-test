import { AlertTriangle } from "lucide-react";
import Modal from "./Modal.jsx";
import Button from "./Button.jsx";

/** Pre-composed yes/no dialog built on Modal. */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  icon = AlertTriangle,
  tone = "danger",
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  loadingText,
  children,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={icon}
      tone={tone}
      size="sm"
      dismissible={!loading}
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {loading && loadingText ? loadingText : confirmText}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
