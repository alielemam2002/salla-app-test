import { RotateCcw, Tag } from "lucide-react";
import { Alert, Button, Modal } from "../ui/index.js";
import { useBulkDiscount } from "../../hooks/discounts/useBulkDiscount.js";
import DiscountModeToggle from "./DiscountModeToggle.jsx";
import DiscountTargetStep from "./DiscountTargetStep.jsx";
import DiscountConfigStep from "./DiscountConfigStep.jsx";
import DiscountPreview from "./DiscountPreview.jsx";
import DiscountConfirmStep from "./DiscountConfirmStep.jsx";
import DiscountResult from "./DiscountResult.jsx";

/** Bulk apply/remove sale prices via Salla's bulkPrice endpoint. */
export default function BulkDiscountModal({
  isOpen,
  onClose,
  selectedProducts = [],
  allLoadedProducts = [],
  totalStoreProducts = 0,
  categories = [],
  token,
  onSuccess,
  showToast,
}) {
  const bulk = useBulkDiscount({
    isOpen,
    selectedProducts,
    allLoadedProducts,
    totalStoreProducts,
    categories,
    token,
    onSuccess,
    showToast,
  });

  const isApply = bulk.mode === "apply";
  const disabled = bulk.isProcessing;

  let body;
  let footer;
  if (bulk.resultSummary) {
    body = <DiscountResult summary={bulk.resultSummary} onDone={onClose} />;
    footer = (
      <Button variant="primary" onClick={onClose}>
        إغلاق
      </Button>
    );
  } else if (bulk.isConfirming) {
    body = (
      <DiscountConfirmStep
        mode={bulk.mode}
        discountType={bulk.discountType}
        discountValue={bulk.discountValue}
        target={bulk.target}
        selectedCount={selectedProducts.length}
        selectedCategoryId={bulk.selectedCategoryId}
        saleEndDate={bulk.saleEndDate}
        estimatedTargetCount={bulk.estimatedTargetCount}
        isProcessing={bulk.isProcessing}
        processStep={bulk.processStep}
        progressInfo={bulk.progressInfo}
      />
    );
    footer = (
      <>
        <Button onClick={() => bulk.setIsConfirming(false)} disabled={disabled}>
          رجوع
        </Button>
        <Button
          variant={isApply ? "primary" : "danger"}
          onClick={bulk.execute}
          loading={bulk.isProcessing}
        >
          {bulk.isProcessing
            ? "جارٍ المعالجة…"
            : isApply
              ? "تأكيد وتطبيق الخصم"
              : "تأكيد وإزالة الخصم"}
        </Button>
      </>
    );
  } else {
    body = (
      <>
        <DiscountTargetStep
          target={bulk.target}
          onTargetChange={bulk.setTarget}
          selectedCount={selectedProducts.length}
          categories={categories}
          selectedCategoryId={bulk.selectedCategoryId}
          onCategoryChange={bulk.setSelectedCategoryId}
          disabled={disabled}
        />
        <div className="form-divider" />
        {isApply ? (
          <DiscountConfigStep
            discountType={bulk.discountType}
            onTypeChange={bulk.setDiscountType}
            discountValue={bulk.discountValue}
            onValueChange={bulk.setDiscountValue}
            saleEndDate={bulk.saleEndDate}
            onSaleEndDateChange={bulk.setSaleEndDate}
            disabled={disabled}
          />
        ) : (
          <Alert tone="info" title="إعادة الأسعار إلى أصلها:">
            سيتم حذف سعر التخفيض وإعادة السعر الأساسي لكل المنتجات المطابقة في
            سلة.
          </Alert>
        )}
        <div className="form-divider" />
        <DiscountPreview
          rows={bulk.previewRows}
          mode={bulk.mode}
          discountType={bulk.discountType}
          discountValue={bulk.discountValue}
          estimatedTargetCount={bulk.estimatedTargetCount}
        />
      </>
    );
    footer = (
      <>
        {bulk.validationError && (
          <span className="bulk-validation-msg" role="status">
            {bulk.validationError}
          </span>
        )}
        <Button onClick={onClose} disabled={disabled}>
          إلغاء
        </Button>
        <Button
          variant={isApply ? "primary" : "danger"}
          onClick={() => bulk.setIsConfirming(true)}
          disabled={Boolean(bulk.validationError) || disabled}
        >
          {isApply ? "مراجعة وتطبيق الخصم" : "مراجعة وإزالة الخصم"}
        </Button>
      </>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      icon={isApply ? Tag : RotateCcw}
      tone={isApply ? "default" : "danger"}
      title={isApply ? "خصم جماعي على المنتجات" : "إزالة خصومات المنتجات"}
      subtitle={
        isApply
          ? "اختر المنتجات وحدّد قيمة الخصم، ثم راجع التغييرات قبل التطبيق"
          : "أعد الأسعار الأساسية للمنتجات بإزالة سعر التخفيض"
      }
      dismissible={!bulk.isProcessing}
      headerExtra={
        <DiscountModeToggle
          mode={bulk.mode}
          onChange={bulk.setMode}
          disabled={disabled}
        />
      }
      footer={footer}
    >
      {bulk.generalError && (
        <Alert tone="error" title="تعذّر التنفيذ">
          {bulk.generalError}
        </Alert>
      )}
      {body}
    </Modal>
  );
}
