import { cx } from "./cx.js";

/**
 * Label/value rows.
 * items: [{ label, value, mono?, tone? }]
 */
export default function KeyValueList({ items, className }) {
  return (
    <dl className={cx("ui-kv", className)}>
      {items.map(({ label, value, mono = true, tone }) => (
        <div key={label} className="data-item">
          <dt className="data-label">{label}</dt>
          <dd
            className={cx(
              "data-value",
              !mono && "data-value--text",
              tone && `data-value--${tone}`,
            )}
          >
            {value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
