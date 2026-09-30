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
      label: "الإجراء",
      value: isApply ? "تطبيق الخصم" : "إزالة سعر التخفيض",
      mono: false,
    },
    isApply && {
      label: "الخصم",
      value: formatDiscount(discountType, discountValue),
    },
    {
      label: "النطاق",
      value: describeTarget({ target, selectedCount, selectedCategoryId }),
      mono: false,
    },
    isApply &&
      saleEndDate && { label: "تاريخ انتهاء التخفيض", value: saleEndDate },
  ].filter(Boolean);

  return (
    <div className="bulk-confirm-step">
      <Alert tone="warning" title="يرجى تأكيد التحديث الجماعي">
        أنت على وشك {isApply ? "تطبيق خصم على" : "إزالة الخصومات من"}{" "}
        <strong>{estimatedTargetCount}</strong> منتج في سلة.
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
