import { Tag } from "lucide-react";
import { Button } from "../ui/index.js";

/** Sticky bar shown while one or more rows are selected. */
export default function ProductsSelectionBar({
  count,
  onBulkDiscount,
  onClear,
}) {
  if (count === 0) return null;
  return (
    <div
      className="products-selection-bar"
      role="region"
      aria-label="Selection"
    >
      <div className="products-selection-info">
        <strong>{count}</strong> products selected
      </div>
      <div className="products-selection-actions">
        <Button
          size="small"
          variant="accent"
          icon={Tag}
          onClick={onBulkDiscount}
        >
          Bulk Discount ({count})
        </Button>
        <Button size="small" variant="ghost" onClick={onClear}>
          Deselect all
        </Button>
      </div>
    </div>
  );
}
