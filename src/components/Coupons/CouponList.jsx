import { STATUS_META } from "../../utils/coupons/couponModel.js";
import CouponCard from "./CouponCard.jsx";

const SECTION_ORDER = ["active", "scheduled", "expired", "disabled"];

/** Coupons grouped by status: ACTIVE, SCHEDULED, EXPIRED, DISABLED. */
export default function CouponList({ items, onView, onEdit, onDelete }) {
  return (
    <div className="coupon-sections">
      {SECTION_ORDER.map((status) => {
        const group = items.filter((item) => item.status === status);
        if (!group.length) return null;
        const headingId = `coupon-section-${status}`;
        return (
          <section
            key={status}
            className="coupon-section"
            aria-labelledby={headingId}
          >
            <h3 id={headingId} className="coupon-section-title">
              {STATUS_META[status].label}
              <span className="coupon-section-count">{group.length}</span>
            </h3>
            <div className="coupon-grid">
              {group.map(({ coupon }) => (
                <CouponCard
                  key={coupon.id}
                  coupon={coupon}
                  status={status}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
