import { Store } from "lucide-react";

/** "Applies to: Entire Store" (or the restricted scope for other coupons). */
export default function CouponScope({ storewide = true, detailed = false }) {
  return (
    <div
      className={
        storewide ? "coupon-scope" : "coupon-scope coupon-scope--limited"
      }
    >
      <Store size={14} aria-hidden="true" />
      <span className="coupon-scope-text">
        <span className="coupon-scope-label">Applies to:</span>{" "}
        <strong>{storewide ? "Entire Store" : "Selected products only"}</strong>
        {detailed && storewide && (
          <span className="coupon-scope-hint">
            The discount applies to every product in your store.
          </span>
        )}
      </span>
    </div>
  );
}
