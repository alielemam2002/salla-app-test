import { cx } from "./cx.js";

/** Surface container. Compose with `Card.Header` and `Card.Body`. */
export default function Card({
  as: Tag = "section",
  className,
  children,
  ...props
}) {
  return (
    <Tag className={cx("panel", className)} {...props}>
      {children}
    </Tag>
  );
}

function CardHeader({ icon: Icon, title, subtitle, actions, className }) {
  return (
    <div className={cx("panel-header", className)}>
      <div className="panel-heading">
        {Icon && (
          <span className="panel-icon" aria-hidden="true">
            <Icon size={16} />
          </span>
        )}
        <div className="panel-heading-text">
          <h2 className="panel-title">{title}</h2>
          {subtitle && <p className="panel-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="panel-actions">{actions}</div>}
    </div>
  );
}

function CardBody({ className, children }) {
  return <div className={cx("panel-body", className)}>{children}</div>;
}

Card.Header = CardHeader;
Card.Body = CardBody;
