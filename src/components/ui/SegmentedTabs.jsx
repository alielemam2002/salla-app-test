import { cx } from "./cx.js";

/**
 * Tab strip. tabs: [{ id, label, icon?, badge? }]
 * variant: "underline" (page tabs) | "pill" (in-card switcher)
 */
export default function SegmentedTabs({
  tabs,
  activeTab,
  onTabChange,
  variant = "underline",
  ariaLabel,
  className,
}) {
  return (
    <div
      className={cx("ui-tabs", `ui-tabs--${variant}`, className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map(({ id, label, icon: Icon, badge }) => {
        const active = id === activeTab;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx("ui-tab", active && "active")}
            onClick={() => onTabChange(id)}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            <span>{label}</span>
            {badge != null && badge !== false && (
              <span className="ui-tab-badge">{badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
