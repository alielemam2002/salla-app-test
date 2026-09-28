import { memo } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Badge, Button } from "../ui/index.js";
import {
  COUPON_STATUS,
  STATUS_META,
  formatDiscount,
  getCountdownTarget,
  getUnmanagedSettings,
  getUsage,
  isStorewide,
} from "../../utils/coupons/couponModel.js";
import CouponCountdown from "./CouponCountdown.jsx";
import CouponScope from "./CouponScope.jsx";
import { getCouponDisplaySettings } from "../../utils/coupons/displaySettingsStorage.js";

function UsageLine({ coupon }) {
  const { used, limit } = getUsage(coupon);
  if (used === null && limit === null) return null;
  let text;
  if (used !== null)
    text = limit ? `Used: ${used} / ${limit}` : `Used: ${used}`;
  else text = `Usage limit: ${limit}`;
  return <p className="coupon-card-usage">{text}</p>;
}

/** One coupon. Memoized: the list re-renders without touching every card. */
function CouponCard({ coupon, status, onView, onEdit, onDelete }) {
  const meta = STATUS_META[status];
  const target = getCountdownTarget(coupon, status);
  const unmanaged = getUnmanagedSettings(coupon);
  const display = getCouponDisplaySettings(coupon.code, coupon);
  const titleId = `coupon-${coupon.id}-title`;

  return (
    <article
      className={`coupon-card coupon-card--${status}`}
      aria-labelledby={titleId}
    >
      <header className="coupon-card-head">
        <h4 id={titleId} className="coupon-card-code">
          {coupon.code}
        </h4>
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
      </header>

      <p className="coupon-card-discount">{formatDiscount(coupon)}</p>
      <CouponScope storewide={isStorewide(coupon)} />

      {target !== null && (
        <CouponCountdown
          target={target}
          label={status === COUPON_STATUS.SCHEDULED ? "Starts in" : "Ends in"}
        />
      )}

      <UsageLine coupon={coupon} />

      <div className="coupon-placements-list" title="أماكن ظهور الكوبون في المتجر">
        {display.show_announcement_bar && (
          <span className="placement-pill placement-pill--announcement">📢 شريط إعلاني</span>
        )}
        {display.display_product_page && (
          <span className="placement-pill">🛍️ صفحة المنتج</span>
        )}
        {display.display_cart_page && (
          <span className="placement-pill">🛒 السلة</span>
        )}
        {display.display_category_page && (
          <span className="placement-pill">🗂️ قائمة المنتجات</span>
        )}
      </div>

      <div className="coupon-card-actions">
        <Button
          size="small"
          variant="secondary"
          icon={Eye}
          onClick={() => onView(coupon)}
          aria-label={`View ${coupon.code}`}
        >
          View
        </Button>
        <Button
          size="small"
          variant="secondary"
          icon={Pencil}
          onClick={() => onEdit(coupon)}
          disabled={unmanaged.length > 0}
          title={
            unmanaged.length
              ? `Edit in the Salla dashboard (has ${unmanaged.join(", ")})`
              : undefined
          }
          aria-label={`Edit ${coupon.code}`}
        >
          Edit
        </Button>
        <Button
          size="small"
          variant="danger"
          icon={Trash2}
          onClick={() => onDelete(coupon)}
          aria-label={`Delete ${coupon.code}`}
        >
          Delete
        </Button>
      </div>
    </article>
  );
}

export default memo(CouponCard);
