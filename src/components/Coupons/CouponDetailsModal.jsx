import { Ticket } from "lucide-react";
import { Alert, Badge, KeyValueList, Modal } from "../ui/index.js";
import {
  STATUS_META,
  formatDiscount,
  getUnmanagedSettings,
  getUsage,
  isStorewide,
  moneyCurrency,
  moneyValue,
} from "../../utils/coupons/couponModel.js";
import CouponScope from "./CouponScope.jsx";

const yesNo = (v) => (v ? "نعم" : "لا");

/** Read-only view of everything Salla returned for one coupon. */
export default function CouponDetailsModal({
  isOpen,
  coupon,
  status,
  onClose,
}) {
  if (!coupon) return null;
  const currency = moneyCurrency(coupon.amount, coupon.maximum_amount);
  const money = (v) => {
    const n = moneyValue(v);
    return n ? `${n} ${currency}` : "—";
  };
  const { used, limit } = getUsage(coupon);
  const unmanaged = getUnmanagedSettings(coupon);
  const meta = STATUS_META[status];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      icon={Ticket}
      title={<bdi dir="ltr">{coupon.code}</bdi>}
      subtitle={formatDiscount(coupon)}
      headerExtra={
        meta && (
          <div className="coupon-details-status">
            <Badge tone={meta.tone} dot>
              {meta.label}
            </Badge>
          </div>
        )
      }
    >
      <CouponScope
        storewide={isStorewide(coupon)}
        count={Array.isArray(coupon?.include_product_ids) ? coupon.include_product_ids.length : 0}
        detailed
      />
      <KeyValueList
        items={[
          { label: "قيمة الخصم", value: formatDiscount(coupon), mono: false },
          { label: "الحد الأقصى للخصم", value: money(coupon.maximum_amount) },
          { label: "الحد الأدنى للطلب", value: money(coupon.minimum_amount) },
          { label: "تاريخ البداية", value: coupon.start_date || "فورًا" },
          { label: "تاريخ الانتهاء", value: coupon.expiry_date || "—" },
          { label: "عدد مرات الاستخدام", value: used ?? "غير متوفر من سلة" },
          { label: "حد الاستخدام", value: limit ?? "غير محدود" },
          {
            label: "حد الاستخدام لكل عميل",
            value: coupon.usage_limit_per_user || "غير محدود",
          },
          { label: "شحن مجاني", value: yesNo(coupon.free_shipping) },
          {
            label: "استثناء المنتجات المخفضة",
            value: yesNo(coupon.is_sale_products_exclude),
          },
          { label: "الحالة في سلة", value: coupon.status || "—" },
          { label: "معرّف الكوبون", value: coupon.id },
        ]}
      />
      <p className="coupon-details-note">التواريخ بتوقيت المتجر (الرياض).</p>
      {unmanaged.length > 0 && (
        <Alert tone="info" title="عدّل هذا الكوبون من لوحة تحكم سلة">
          يحتوي على إعدادات لا تُدار من هذه الصفحة: {unmanaged.join("، ")}. حفظ
          التعديل من هنا قد يحذفها.
        </Alert>
      )}
    </Modal>
  );
}
