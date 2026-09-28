import { Badge } from "../ui/index.js";

/** "Showing X of Y" line plus active filter chips. */
export default function ProductsSummary({
  count,
  total,
  page,
  totalPages,
  showingAll,
  appliedKeyword,
  statusFilter,
}) {
  return (
    <div className="products-summary">
      <span>
        {showingAll
          ? `Showing all ${count} products`
          : `Showing ${count} of ${total} products · page ${page} of ${totalPages}`}
      </span>
      {appliedKeyword && (
        <Badge tone="primary">Keyword: &quot;{appliedKeyword}&quot;</Badge>
      )}
      {statusFilter && <Badge tone="primary">Status: {statusFilter}</Badge>}
    </div>
  );
}
