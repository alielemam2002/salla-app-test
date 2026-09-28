import { cx } from "./cx.js";

/** Compact metric tile: label, big value, optional hint. */
export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
  className,
}) {
  return (
    <div className={cx("ui-stat", `ui-stat--${tone}`, className)}>
      <div className="ui-stat-top">
        {Icon && (
          <span className="ui-stat-icon" aria-hidden="true">
            <Icon size={16} />
          </span>
        )}
        <span className="ui-stat-label">{label}</span>
      </div>
      <div className="ui-stat-value">{value}</div>
      {hint && <div className="ui-stat-hint">{hint}</div>}
    </div>
  );
}
