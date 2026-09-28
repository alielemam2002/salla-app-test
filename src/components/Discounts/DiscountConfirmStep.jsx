import { Alert, KeyValueList, Spinner } from "../ui/index.js";
import { describeTarget, formatDiscount } from "../../utils/bulkDiscount.js";

/** Review summary shown before (and while) the bulk update runs. */
export default function DiscountConfirmStep({
  mode,
  discountType,
  discountValue,
  target,
  selectedCount,
  selectedCategoryId,
  saleEndDate,
  estimatedTargetCount,
  isProcessing,
  processStep,
  progressInfo,
}) {
  const isApply = mode === "apply";

  const items = [
    {
      label: "Action",
      value: isApply ? "Apply Discount" : "Remove Sale Price",
      mono: false,
    },
    isApply && {
      label: "Discount",
      value: formatDiscount(discountType, discountValue),
    },
    {
      label: "Target",
      value: describeTarget({ target, selectedCount, selectedCategoryId }),
      mono: false,
    },
    isApply && saleEndDate && { label: "Sale End Date", value: saleEndDate },
  ].filter(Boolean);

  return (
    <div className="bulk-confirm-step">
      <Alert tone="warning" title="Please confirm bulk update">
        You are about to{" "}
        {isApply ? "apply a discount to" : "remove discounts from"}{" "}
        <strong>{estimatedTargetCount}</strong> products on Salla.
      </Alert>

      <KeyValueList className="confirm-summary-box" items={items} />

      {isProcessing && (
        <div className="bulk-progress-box" aria-live="polite">
          <Spinner size={20} />
          <div>
            <strong>{processStep}</strong>
            {progressInfo && <span>{progressInfo}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
