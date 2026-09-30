import { useId } from "react";
import { CheckCircle2, ShoppingCart } from "lucide-react";
import { Alert, Badge, Button } from "../ui/index.js";
import { cx } from "../ui/cx.js";

const STATUS_CONFIG = {
  idle: { label: "شراء", variant: "primary", disabled: false },
  pending: { label: "جارٍ المعالجة…", variant: "primary", loading: true },
  success: { label: "تم الشراء", variant: "success", disabled: true },
  error: { label: "إعادة المحاولة", variant: "danger", disabled: false },
};

const STATUS_BADGE = {
  pending: { tone: "warning", label: "قيد الانتظار" },
  success: { tone: "success", label: "تم الشراء" },
  error: { tone: "danger", label: "فشل" },
};

/** One addon: select, set quantity, buy. Presentational only. */
export default function AddonCard({
  addon,
  checkoutState,
  onBuy,
  selected,
  onToggleSelect,
  onQuantityChange,
}) {
  const { status, result } = checkoutState;
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const badge = STATUS_BADGE[status];
  const quantity = addon._quantity || 1;
  const qtyId = useId();

  return (
    <article
      className={cx(
        "addon-card",
        `addon-card--${status}`,
        selected && "addon-card--selected",
      )}
    >
      <div className="addon-card-top">
        <input
          type="checkbox"
          className="addon-card-select"
          checked={selected}
          onChange={() => onToggleSelect(addon.slug)}
          aria-label={`تحديد ${addon.name}`}
        />
        <div className="addon-card-header">
          <h3 className="addon-card-name">{addon.name}</h3>
          <code className="addon-card-slug" dir="ltr">
            {addon.slug}
          </code>
        </div>
        {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
      </div>

      {addon.description && (
        <p className="addon-card-description">{addon.description}</p>
      )}

      <div className="addon-card-footer">
        <div className="addon-card-price">
          <span className="addon-card-amount">{addon.price}</span>
          {addon.currency && (
            <span className="addon-card-currency">{addon.currency}</span>
          )}
        </div>
        <div className="addon-card-actions">
          <label className="addon-card-quantity-label" htmlFor={qtyId}>
            الكمية
          </label>
          <input
            id={qtyId}
            type="number"
            className="form-input addon-card-quantity"
            min={1}
            value={quantity}
            onChange={(e) =>
              onQuantityChange(
                addon.slug,
                Math.max(1, parseInt(e.target.value) || 1),
              )
            }
          />
          <Button
            variant={config.variant}
            disabled={config.disabled}
            loading={config.loading}
            icon={status === "success" ? CheckCircle2 : ShoppingCart}
            onClick={() => onBuy(addon)}
          >
            {config.label}
          </Button>
        </div>
      </div>

      {status === "success" && result && (
        <Alert tone="success">
          رقم الطلب: <span dir="ltr">{result.order_id || "غير متوفر"}</span> —
          الحالة: {result.status}
        </Alert>
      )}
      {status === "error" && result?.error && (
        <Alert tone="error">تعذّر إتمام الشراء: {result.error.message}</Alert>
      )}
    </article>
  );
}
