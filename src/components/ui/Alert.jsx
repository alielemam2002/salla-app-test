import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cx } from "./cx.js";

const ICONS = {
  error: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

/** Inline message box. tone: error | warning | success | info */
export default function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}) {
  const Icon = ICONS[tone] || Info;
  return (
    <div
      className={cx("form-alert", `form-alert--${tone}`, className)}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon size={16} aria-hidden="true" className="form-alert-icon" />
      <div className="form-alert-content">
        {title && <strong className="form-alert-title">{title}</strong>}
        {children && <div className="form-alert-body">{children}</div>}
      </div>
      {action && <div className="form-alert-action">{action}</div>}
    </div>
  );
}
