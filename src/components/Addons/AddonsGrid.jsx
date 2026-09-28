import { Card, Skeleton } from "../ui/index.js";
import AddonCard from "./AddonCard.jsx";

export function AddonsGridSkeleton({ count = 3 }) {
  return (
    <div className="addons-grid" aria-busy="true" aria-label="Loading addons">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} as="div" className="addon-card addon-card--skeleton">
          <Skeleton width="60%" height={18} />
          <Skeleton width="35%" height={12} />
          <Skeleton height={36} />
          <Skeleton width="45%" height={24} />
        </Card>
      ))}
    </div>
  );
}

/** Grid of addon cards. Presentational only. */
export default function AddonsGrid({
  addons,
  selected,
  getCheckoutState,
  onBuy,
  onToggleSelect,
  onQuantityChange,
}) {
  return (
    <div className="addons-grid">
      {addons.map((addon) => (
        <AddonCard
          key={addon.slug}
          addon={addon}
          checkoutState={getCheckoutState(addon.slug)}
          onBuy={onBuy}
          selected={selected.has(addon.slug)}
          onToggleSelect={onToggleSelect}
          onQuantityChange={onQuantityChange}
        />
      ))}
    </div>
  );
}
