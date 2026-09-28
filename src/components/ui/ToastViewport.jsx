import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

/** Renders the toast stack. State lives in ToastContext. */
export default function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type] || Info;
        return (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            role={toast.type === "error" ? "alert" : "status"}
            onClick={() => onDismiss(toast.id)}
          >
            <Icon size={18} className="toast-icon" aria-hidden="true" />
            <span className="toast-message">{toast.message}</span>
            <X size={14} className="toast-close" aria-hidden="true" />
          </div>
        );
      })}
    </div>
  );
}
