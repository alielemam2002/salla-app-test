import { Tag } from "lucide-react";
import { Button } from "../ui/index.js";
import BulkActionMenu from "../BulkActions/BulkActionMenu.jsx";
import {
  MORE_ACTIONS,
  PRIMARY_ACTIONS,
} from "../../utils/bulkActions/bulkActionUi.js";

/**
 * Sticky bar shown while one or more rows are selected: selection scope,
 * "select all matching", Salla bulk actions and the existing Bulk Discount.
 */
export default function ProductsSelectionBar({
  count,
  onBulkDiscount,
  onClear,
  allMatching = false,
  canSelectAllMatching = false,
  matchingTotal = 0,
  onSelectAllMatching,
  searchBlocksSelectAll = false,
  filterLabels = [],
  onBulkAction,
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
        {allMatching && (
          <span className="products-selection-scope">
            {" "}
            · all matching
            {filterLabels.length ? ` ${filterLabels.join(", ")}` : " products"}
          </span>
        )}
        {canSelectAllMatching && (
          <Button
            size="small"
            variant="ghost"
            className="products-select-all-matching"
            onClick={onSelectAllMatching}
          >
            Select all {matchingTotal} matching
          </Button>
        )}
        {searchBlocksSelectAll && (
          <span className="products-selection-note">
            Search results can&apos;t be selected across pages: Salla&apos;s
            bulk filters have no text search.
          </span>
        )}
      </div>
      <div className="products-selection-actions">
        {onBulkAction &&
          PRIMARY_ACTIONS.map((action) => (
            <Button
              key={action.key}
              size="small"
              variant="secondary"
              onClick={() => onBulkAction(action)}
            >
              {action.label}
            </Button>
          ))}
        {onBulkAction && (
          <BulkActionMenu actions={MORE_ACTIONS} onSelect={onBulkAction} />
        )}
        {!allMatching && (
          <Button
            size="small"
            variant="accent"
            icon={Tag}
            onClick={onBulkDiscount}
          >
            Bulk Discount ({count})
          </Button>
        )}
        <Button size="small" variant="ghost" onClick={onClear}>
          Deselect all
        </Button>
      </div>
    </div>
  );
}
