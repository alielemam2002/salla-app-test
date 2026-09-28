import { cx } from "./cx.js";

/** Centered placeholder for empty, error, or first-run views. */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "neutral",
  className,
}) {
  return (
    <div className={cx("ui-empty", `ui-empty--${tone}`, className)}>
      {Icon && (
        <span className="ui-empty-icon" aria-hidden="true">
          <Icon size={24} />
        </span>
      )}
      {title && <h3 className="ui-empty-title">{title}</h3>}
      {description && <div className="ui-empty-desc">{description}</div>}
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  );
}
