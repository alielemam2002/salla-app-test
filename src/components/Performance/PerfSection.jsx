import { Card, SectionHeader, cx } from "../ui/index.js";

/** Card with a titled header used by every Performance Center block. */
export default function PerfSection({
  icon,
  title,
  description,
  actions,
  ariaLabel,
  className,
  children,
}) {
  return (
    <Card
      className={cx("perf-section", className)}
      aria-label={ariaLabel || (typeof title === "string" ? title : undefined)}
    >
      <SectionHeader
        as="h3"
        icon={icon}
        title={title}
        description={description}
        actions={actions}
        className="perf-section-head"
      />
      <div className="perf-section-content">{children}</div>
    </Card>
  );
}
