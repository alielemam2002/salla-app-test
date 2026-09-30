import { History, RefreshCw, Trash2 } from "lucide-react";
import { Badge, Button } from "../ui/index.js";
import { useBulkOperations } from "../../hooks/bulkActions/useBulkOperations.js";
import { operationStatusMeta } from "../../utils/bulkActions/bulkOperationsLog.js";

const formatTime = (iso) => {
  try {
    return new Date(iso).toLocaleString("ar-SA-u-nu-latn");
  } catch {
    return iso;
  }
};

/**
 * Operation center: the bulk operations Salla accepted from this browser.
 * No progress bar: Salla has no endpoint to read an operation's progress,
 * so the status is the one Salla returned when it accepted the request.
 */
export default function BulkOperationsPanel({ onRefreshProducts }) {
  const { operations, clear } = useBulkOperations();
  if (!operations.length) return null;

  return (
    <section className="bulk-ops" aria-labelledby="bulk-ops-title">
      <header className="bulk-ops-head">
        <h3 id="bulk-ops-title" className="bulk-ops-title">
          <History size={16} aria-hidden="true" /> العمليات الجماعية
        </h3>
        <div className="bulk-ops-actions">
          <Button size="small" icon={RefreshCw} onClick={onRefreshProducts}>
            تحديث المنتجات
          </Button>
          <Button size="small" variant="ghost" icon={Trash2} onClick={clear}>
            مسح السجل
          </Button>
        </div>
      </header>
      <p className="form-hint">
        لا تعرض سلة تقدّم العمليات الموضوعة في قائمة الانتظار. حدّث المنتجات
        لرؤية التغييرات بعد أن تنتهي سلة منها.
      </p>
      <ul className="bulk-ops-list">
        {operations.map((entry) => {
          const status = entry.operations[0]?.status;
          const meta = operationStatusMeta(status);
          return (
            <li key={entry.id} className="bulk-ops-item">
              <div className="bulk-ops-main">
                <strong>{entry.label}</strong>
                <span className="bulk-ops-summary">{entry.summary}</span>
                <span className="bulk-ops-meta">
                  {entry.productCount} منتج · {formatTime(entry.createdAt)}
                </span>
                {entry.operations.map((op) => (
                  <code key={op.operation_id} className="bulk-ops-id" dir="ltr">
                    {op.operation_id}
                  </code>
                ))}
              </div>
              <Badge tone={meta.tone} dot>
                {meta.label}
              </Badge>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
