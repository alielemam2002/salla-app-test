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
import CouponStorePreview from "./CouponStorePreview.jsx";
import { getCouponDisplaySettings } from "../../utils/coupons/displaySettingsStorage.js";

const yesNo = (v) => (v ? "Yes" : "No");

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
      title={coupon.code}
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
      <CouponScope storewide={isStorewide(coupon)} detailed />
      <KeyValueList
        items={[
          { label: "Discount", value: formatDiscount(coupon), mono: false },
          { label: "Maximum discount", value: money(coupon.maximum_amount) },
          { label: "Minimum order", value: money(coupon.minimum_amount) },
          { label: "Starts", value: coupon.start_date || "Immediately" },
          { label: "Ends", value: coupon.expiry_date || "—" },
          { label: "Times used", value: used ?? "Not reported by Salla" },
          { label: "Usage limit", value: limit ?? "Unlimited" },
          {
            label: "Limit per customer",
            value: coupon.usage_limit_per_user || "Unlimited",
          },
          { label: "Free shipping", value: yesNo(coupon.free_shipping) },
          {
            label: "Excludes sale products",
            value: yesNo(coupon.is_sale_products_exclude),
          },
          { label: "Salla status", value: coupon.status || "—" },
          { label: "Coupon ID", value: coupon.id },
        ]}
      />
      <p className="coupon-details-note">Dates are in store time (Riyadh).</p>
      {unmanaged.length > 0 && (
        <Alert tone="info" title="Edit this coupon in the Salla dashboard">
          It has settings this page doesn't manage: {unmanaged.join(", ")}.
          Saving here could remove them.
        </Alert>
      )}

      <CouponStorePreview
        code={coupon.code}
        badgeTitle={display.card_badge_title}
        headlineText={display.card_headline_text}
        showAnnouncement={display.show_announcement_bar}
        announcementText={display.announcement_text}
        announcementBg={display.announcement_bg_color}
        announcementTextColor={display.announcement_text_color}
        cardBg={display.card_bg_color}
        cardTextColor={display.card_text_color}
        displayProductPage={display.display_product_page}
        displayCategoryPage={display.display_category_page}
        displayCartPage={display.display_cart_page}
      />
    </Modal>
  );
}
