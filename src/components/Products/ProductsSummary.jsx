import { Badge } from "../ui/index.js";
import { statusLabel } from "../../utils/productConstants.js";

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
          ? `عرض كل المنتجات (${count})`
          : `عرض ${count} من ${total} منتج · الصفحة ${page} من ${totalPages}`}
      </span>
      {appliedKeyword && (
        <Badge tone="primary">الكلمة: &quot;{appliedKeyword}&quot;</Badge>
      )}
      {statusFilter && (
        <Badge tone="primary">الحالة: {statusLabel(statusFilter)}</Badge>
      )}
    </div>
  );
}
