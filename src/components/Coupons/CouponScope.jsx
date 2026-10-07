import { Store } from "lucide-react";

/** "ينطبق على: المتجر بالكامل" (or the restricted scope for other coupons). */
export default function CouponScope({
  storewide = true,
  detailed = false,
  count = 0,
}) {
  return (
    <div
      className={
        storewide ? "coupon-scope" : "coupon-scope coupon-scope--limited"
      }
    >
      <Store size={14} aria-hidden="true" />
      <span className="coupon-scope-text">
        <span className="coupon-scope-label">ينطبق على:</span>{" "}
        <strong>
          {storewide
            ? "المتجر بالكامل"
            : count === 1
              ? "منتج محدد فقط"
              : count > 1
                ? `${count} منتجات محددة`
                : "منتجات محددة فقط"}
        </strong>
        {detailed && (
          <span className="coupon-scope-hint">
            {storewide
              ? "الخصم يشمل جميع منتجات متجرك، ولا يحتاج العميل لاختيار منتج معيّن."
              : "يُطبّق الخصم فقط عندما يضيف العميل هذا المنتج إلى سلته."}
          </span>
        )}
      </span>
    </div>
  );
}
