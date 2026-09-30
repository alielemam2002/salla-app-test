import { Banknote, MessageCircle, Phone, ShoppingCart } from "lucide-react";
import { StatCard } from "../ui/index.js";
import { formatMoney } from "../../utils/cartRecovery/cartModel.js";

/**
 * Dashboard tiles from data we actually have. Recovered carts, recovery
 * rate and recovered revenue need Salla's abandoned.cart.purchased webhook
 * and storage (Stage 2), so they aren't shown.
 */
export default function CartRecoveryStats({ summary, contactedCount, label }) {
  const revenue = summary.revenue.length
    ? summary.revenue.map(formatMoney).join(" · ")
    : "—";
  return (
    <div className="cart-stats">
      <StatCard
        icon={ShoppingCart}
        label="السلات المتروكة"
        value={summary.eligible}
        hint={`أقدم من ${label}`}
        tone="warning"
      />
      <StatCard
        icon={Banknote}
        label="الإيرادات المحتملة"
        value={revenue}
        hint="مجموع قيمة هذه السلات"
        tone="primary"
      />
      <StatCard
        icon={Phone}
        label="يمكن مراسلتهم عبر واتساب"
        value={summary.withPhone}
        hint="لديهم رقم جوال"
      />
      <StatCard
        icon={MessageCircle}
        label="محادثات واتساب المفتوحة"
        value={contactedCount}
        hint="من هذا المتصفح؛ الإرسال بيدك"
        tone="success"
      />
    </div>
  );
}
