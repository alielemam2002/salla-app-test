import { Store } from "lucide-react";

/** "ينطبق على: المتجر بالكامل" (or the restricted scope for other coupons). */
export default function CouponScope({ storewide = true, detailed = false }) {
  return (
    <div
      className={
        storewide ? "coupon-scope" : "coupon-scope coupon-scope--limited"
      }
    >
      <Store size={14} aria-hidden="true" />
      <span className="coupon-scope-text">
        <span className="coupon-scope-label">ينطبق على:</span>{" "}
        <strong>{storewide ? "المتجر بالكامل" : "منتجات محددة فقط"}</strong>
        {detailed && storewide && (
          <span className="coupon-scope-hint">
            الخصم يشمل جميع منتجات متجرك، ولا يحتاج العميل لاختيار منتج معيّن.
          </span>
        )}
      </span>
    </div>
  );
}
