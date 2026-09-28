import { cx } from "./cx.js";

/**
 * Small status pill.
 * tone: neutral | primary | success | warning | danger | info
 */
export default function Badge({
  tone = "neutral",
  dot = false,
  icon: Icon,
  children,
  className,
  ...props
}) {
  return (
    <span className={cx("ui-badge", `ui-badge--${tone}`, className)} {...props}>
      {dot && <span className="ui-badge-dot" aria-hidden="true" />}
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}
