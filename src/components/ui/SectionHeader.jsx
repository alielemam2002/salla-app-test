import { cx } from "./cx.js";

/** Heading row for a group inside a card or page. */
export default function SectionHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
  as: Tag = "h3",
}) {
  return (
    <div className={cx("ui-section-header", className)}>
      <div className="ui-section-header-main">
        {Icon && (
          <span className="ui-section-header-icon" aria-hidden="true">
            <Icon size={16} />
          </span>
        )}
        <div>
          <Tag className="ui-section-header-title">{title}</Tag>
          {description && (
            <p className="ui-section-header-desc">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="ui-section-header-actions">{actions}</div>}
    </div>
  );
}
