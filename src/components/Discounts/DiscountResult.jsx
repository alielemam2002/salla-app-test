import { CheckCircle2 } from "lucide-react";
import { Button, EmptyState } from "../ui/index.js";

/** Success screen after the bulk update was accepted. */
export default function DiscountResult({ summary, onDone }) {
  return (
    <EmptyState
      className="bulk-success-state"
      tone="success"
      icon={CheckCircle2}
      title="تمت العملية بنجاح"
      description={
        <>
          <p>{summary.message}</p>
          <p className="bulk-success-meta">
            المنتجات المحدّثة: <strong>{summary.count}</strong>
          </p>
        </>
      }
      action={
        <Button variant="primary" onClick={onDone}>
          تم
        </Button>
      }
    />
  );
}
