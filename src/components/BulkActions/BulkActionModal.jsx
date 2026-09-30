import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Layers } from "lucide-react";
import { Alert, Button, Modal } from "../ui/index.js";
import { useBulkProductAction } from "../../hooks/bulkActions/useBulkProductAction.js";
import { BULK_ACTION_SCHEMAS } from "../../utils/bulkActions/bulkActionSchemas.js";
import {
  BLOCKING_PROBLEMS,
  DEFAULT_VALUES,
  buildPricingPreview,
  describeAction,
  describeBulkError,
  formToActionValue,
} from "../../utils/bulkActions/bulkActionUi.js";
import { operationStatusMeta } from "../../utils/bulkActions/bulkOperationsLog.js";
import BulkActionPreview from "./BulkActionPreview.jsx";
import {
  ChannelsForm,
  FeaturesForm,
  NotifyForm,
  PricingForm,
} from "./BulkActionForms.jsx";

/**
 * One bulk action, three steps: form → review (preview + confirm) → result.
 * Mounted only while open (keyed by action), so each opening starts clean.
 * `selection` = { count, sampleProducts, bulkSelection, filterLabels }, a
 * snapshot taken when the dialog opened. `onSubmitted` runs once Salla
 * accepts the request (the page clears its selection then).
 */
export default function BulkActionModal({
  uiAction,
  selection,
  lookups,
  currency = "SAR",
  getToken,
  onClose,
  onSubmitted,
  onRefreshProducts,
  showToast,
}) {
  const hasForm = uiAction.key !== "duplicate";
  const [step, setStep] = useState(hasForm ? "form" : "review");
  const [reviewed, setReviewed] = useState(hasForm ? null : {});
  const mutation = useBulkProductAction(getToken);

  const form = useForm({
    resolver: zodResolver(BULK_ACTION_SCHEMAS[uiAction.key]),
    defaultValues: DEFAULT_VALUES[uiAction.key],
  });

  const value = reviewed ? formToActionValue(uiAction, reviewed) : null;
  const pricingRows = useMemo(
    () =>
      uiAction.key === "pricing" && value
        ? buildPricingPreview(selection.sampleProducts, value)
        : null,
    [uiAction.key, value, selection.sampleProducts],
  );
  const blocked = Boolean(
    pricingRows?.some((row) => BLOCKING_PROBLEMS.has(row.problem)),
  );
  const summary = value ? describeAction(uiAction, value, lookups) : "";

  const goReview = form.handleSubmit((data) => {
    setReviewed(data);
    mutation.reset();
    setStep("review");
  });

  const apply = () => {
    if (mutation.isPending || blocked) return;
    mutation.mutate(
      {
        actionName: uiAction.actionName,
        value,
        selection: selection.bulkSelection,
        label: uiAction.title,
        summary,
        productCount: selection.count,
      },
      {
        onSuccess: () => {
          setStep("done");
          onSubmitted?.();
          showToast?.(
            selection.count > 1
              ? `بدأت العملية الجماعية: تتم معالجة ${selection.count} منتج في سلة.`
              : "قبلت سلة التغيير.",
            "success",
          );
        },
      },
    );
  };

  const error = mutation.error
    ? describeBulkError(mutation.error.result)
    : null;

  let body;
  let footer;
  if (step === "form") {
    const props = { form, currency, lookups };
    body = (
      <form onSubmit={goReview} noValidate>
        {uiAction.key === "pricing" && <PricingForm {...props} />}
        {uiAction.actionName === "features" && (
          <FeaturesForm {...props} field={uiAction.field} />
        )}
        {uiAction.key === "channels" && <ChannelsForm {...props} />}
        {uiAction.key === "notify" && <NotifyForm {...props} />}
      </form>
    );
    footer = (
      <>
        <Button onClick={onClose}>إلغاء</Button>
        <Button variant="primary" onClick={goReview}>
          مراجعة التغييرات
        </Button>
      </>
    );
  } else if (step === "review") {
    body = (
      <>
        {error && (
          <Alert tone="error" title={error.title}>
            <p>{error.reason}</p>
            {error.debug && (
              <details className="bulk-error-debug">
                <summary>تفاصيل تقنية</summary>
                <pre>{error.debug}</pre>
              </details>
            )}
          </Alert>
        )}
        {blocked && (
          <Alert tone="error" title="لا يمكن تطبيق هذه الأسعار.">
            عدّل القيمة حتى لا يصبح سعر أي منتج صفرًا أو أقل.
          </Alert>
        )}
        <BulkActionPreview
          title={uiAction.title}
          summary={summary || describeAction(uiAction, {}, lookups)}
          count={selection.count}
          filterLabels={selection.filterLabels}
          sampleProducts={selection.sampleProducts}
          pricingRows={pricingRows}
          pricingColumn={value?.column}
          currency={currency}
          isDuplicate={uiAction.key === "duplicate"}
        />
      </>
    );
    footer = (
      <>
        {hasForm ? (
          <Button onClick={() => setStep("form")} disabled={mutation.isPending}>
            رجوع
          </Button>
        ) : (
          <Button onClick={onClose} disabled={mutation.isPending}>
            إلغاء
          </Button>
        )}
        <Button
          variant={uiAction.danger ? "danger" : "primary"}
          onClick={apply}
          loading={mutation.isPending}
          disabled={blocked}
        >
          {mutation.isPending
            ? "جارٍ التطبيق…"
            : uiAction.key === "duplicate"
              ? "تكرار"
              : "تأكيد وتطبيق"}
        </Button>
      </>
    );
  } else {
    const operations = mutation.data || [];
    body = (
      <div className="bulk-result" role="status">
        <CheckCircle2
          size={32}
          aria-hidden="true"
          className="bulk-result-icon"
        />
        <h4>
          {selection.count > 1 ? "بدأت العملية الجماعية" : "قبلت سلة التغيير"}
        </h4>
        <p>
          {selection.count > 1
            ? `تتم معالجة ${selection.count} منتج في سلة، ويمكنك متابعة عملك أثناء ذلك.`
            : "تطبّق سلة تغييرات المنتج الواحد فورًا. حدّث القائمة لرؤية النتيجة."}
        </p>
        {operations.length > 0 && (
          <ul className="bulk-result-ops">
            {operations.map((op) => (
              <li key={op.operation_id}>
                <span>رقم العملية:</span>{" "}
                <code dir="ltr">{op.operation_id}</code>{" "}
                <span className="bulk-result-status">
                  {operationStatusMeta(op.status).label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
    footer = (
      <>
        <Button onClick={onRefreshProducts}>تحديث المنتجات</Button>
        <Button variant="primary" onClick={onClose}>
          تم
        </Button>
      </>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      dismissible={!mutation.isPending}
      icon={Layers}
      tone={uiAction.danger ? "danger" : "default"}
      title={uiAction.title}
      subtitle={`${selection.count} منتج محدد`}
      size="lg"
      footer={footer}
    >
      {body}
    </Modal>
  );
}
