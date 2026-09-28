import { Search } from "lucide-react";
import { SegmentedTabs, TextInput } from "../ui/index.js";
import { STATUS_META } from "../../utils/coupons/couponModel.js";
import { COUPON_FILTERS } from "../../hooks/coupons/useCouponFilters.js";

/** Status filter pills + coupon code search. */
export default function CouponsToolbar({ filters, disabled }) {
  const tabs = COUPON_FILTERS.map((id) => ({
    id,
    label: id === "all" ? "All" : STATUS_META[id].label,
    badge: filters.counts[id],
  }));

  return (
    <div className="coupons-toolbar">
      <SegmentedTabs
        variant="pill"
        ariaLabel="Filter coupons by status"
        tabs={tabs}
        activeTab={filters.filter}
        onTabChange={filters.setFilter}
      />
      <label className="coupons-search">
        <span className="sr-only">Search coupon code</span>
        <Search size={16} className="coupons-search-icon" aria-hidden="true" />
        <TextInput
          type="search"
          value={filters.query}
          onChange={(e) => filters.setQuery(e.target.value)}
          placeholder="Search coupon code..."
          disabled={disabled}
          className="coupons-search-input"
        />
      </label>
    </div>
  );
}
