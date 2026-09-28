import { cx } from "./cx.js";

/** Square icon-only button. `label` is required for accessibility. */
export default function IconButton({
  icon: Icon,
  label,
  size = 16,
  tone = "default",
  className,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={cx(
        "ui-icon-btn",
        tone !== "default" && `ui-icon-btn--${tone}`,
        className,
      )}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={size} aria-hidden="true" />
    </button>
  );
}
