import { Trash2 } from "lucide-react";
import { Badge, EmptyState, IconButton, Spinner } from "../ui/index.js";

/** Current product options (attributes) with their values. */
export default function OptionsList({ options = [], isLoading, onDelete }) {
  if (isLoading) {
    return <Spinner label="جارِ جلب خيارات المنتج..." />;
  }
  if (options.length === 0) {
    return (
      <EmptyState
        className="editor-sub-empty"
        title="لا توجد خيارات مضافة (مثل: المقاس أو اللون)."
        description='اضغط "إضافة خيار جديد" أعلاه لإنشاء خيارات لهذا المنتج.'
      />
    );
  }

  return (
    <ul className="option-list">
      {options.map((opt) => (
        <li key={opt.id} className="option-card">
          <div className="option-card-head">
            <span className="option-card-name">{opt.name}</span>
            <Badge>نوع: {opt.type || "text"}</Badge>
            <IconButton
              icon={Trash2}
              label="حذف الخيار"
              tone="danger"
              size={14}
              className="option-card-delete"
              onClick={() => onDelete?.(opt.id)}
            />
          </div>
          <div className="option-card-values">
            {Array.isArray(opt.values) && opt.values.length > 0 ? (
              opt.values.map((val, idx) => (
                <span key={val.id || idx} className="editor-chip">
                  {typeof val === "object" ? val.name : val}
                </span>
              ))
            ) : (
              <span className="editor-chips-empty">لا توجد قيم مضافة.</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
