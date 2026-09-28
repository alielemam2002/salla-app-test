import { Loader2 } from "lucide-react";
import { cx } from "./cx.js";

const VARIANT_CLASSES = {
  default: "",
  secondary: "btn-secondary",
  primary: "btn-primary",
  ghost: "btn-ghost",
  success: "btn-success",
  danger: "btn-danger",
  warning: "btn-warning",
  accent: "btn-accent",
  info: "btn-info",
  toggle: "btn-toggle",
};

const SIZE_CLASSES = {
  default: "",
  small: "btn-small",
  icon: "btn-icon",
};

/**
 * Shared button.
 * - `event` renders the two-line SDK event layout (`label` + `hint`), where
 *   `variant` is a coloured accent stripe instead of a solid fill.
 * - `loading` disables the button and shows a spinner.
 * - `icon` renders a leading lucide icon component.
 */
export default function Button({
  variant = "default",
  size = "default",
  event = false,
  loading = false,
  fullWidth = false,
  icon: Icon,
  label,
  hint,
  children,
  className = "",
  disabled,
  type = "button",
  ...props
}) {
  const classes = cx(
    "btn",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    event && "btn-event",
    fullWidth && "btn-block",
    loading && "btn-loading",
    className,
  );

  const iconSize = size === "small" ? 14 : 16;
  const leading = loading ? (
    <Loader2 size={iconSize} className="ui-spin" aria-hidden="true" />
  ) : Icon ? (
    <Icon size={iconSize} aria-hidden="true" />
  ) : null;

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {event ? (
        <>
          {label && <span className="btn-label">{label}</span>}
          {hint && <span className="btn-hint">{hint}</span>}
          {children}
        </>
      ) : (
        <>
          {leading}
          {children}
        </>
      )}
    </button>
  );
}
