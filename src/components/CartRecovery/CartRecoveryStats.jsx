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
        label="Abandoned carts"
        value={summary.eligible}
        hint={`Older than ${label}`}
        tone="warning"
      />
      <StatCard
        icon={Banknote}
        label="Potential revenue"
        value={revenue}
        hint="Sum of those carts' totals"
        tone="primary"
      />
      <StatCard
        icon={Phone}
        label="Reachable on WhatsApp"
        value={summary.withPhone}
        hint="Have a mobile number"
      />
      <StatCard
        icon={MessageCircle}
        label="WhatsApp opened"
        value={contactedCount}
        hint="From this browser; sending is up to you"
        tone="success"
      />
    </div>
  );
}
