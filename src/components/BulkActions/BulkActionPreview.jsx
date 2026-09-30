import { AlertTriangle } from "lucide-react";
import { Alert, Badge } from "../ui/index.js";
import {
  COLUMN_LABELS,
  PREVIEW_LIMIT,
  PREVIEW_PROBLEMS,
} from "../../utils/bulkActions/bulkActionUi.js";

/**
 * Review step: what will run, on how many products, with which filters,
 * and a sample of the affected products (never loads extra products).
 */
export default function BulkActionPreview({
  title,
  summary,
  count,
  filterLabels,
  sampleProducts,
  pricingRows,
  pricingColumn,
  currency,
  isDuplicate,
}) {
  // A sale price is set relative to the price, so show both.
  const showPrice = pricingColumn === "sale_price";
  const columnLabel = COLUMN_LABELS[pricingColumn] || "القيمة";
  const shown = pricingRows || sampleProducts.slice(0, PREVIEW_LIMIT);
  const more = Math.max(0, count - shown.length);

  return (
    <div className="bulk-preview">
      <dl className="bulk-preview-summary">
        <div>
          <dt>الإجراء</dt>
          <dd>{title}</dd>
        </div>
        <div>
          <dt>التفاصيل</dt>
          <dd>{summary}</dd>
        </div>
        <div>
          <dt>المنتجات</dt>
          <dd>
            <strong>{count}</strong>
          </dd>
        </div>
        {filterLabels.length > 0 && (
          <div>
            <dt>الفلاتر الحالية</dt>
            <dd>{filterLabels.join(" · ")}</dd>
          </div>
        )}
      </dl>

      {isDuplicate && (
        <Alert tone="warning" title={`أنت على وشك تكرار ${count} منتج.`}>
          قد يؤدي ذلك إلى إنشاء {count} منتج جديد في متجرك.
        </Alert>
      )}

      {count > 1 && (
        <p className="form-hint">
          تعالج سلة المنتجات المتعددة في قائمة انتظار، وتحسب القيم الجديدة
          بنفسها.
        </p>
      )}

      {shown.length > 0 && (
        <div className="bulk-preview-sample">
          <p className="bulk-preview-caption">
            {pricingRows ? "التغييرات المتوقعة" : "المنتجات"} · معاينة أول{" "}
            {shown.length}
          </p>
          {pricingRows ? (
            <table className="bulk-preview-table">
              <thead>
                <tr>
                  <th scope="col">المنتج</th>
                  {showPrice && <th scope="col">السعر</th>}
                  <th scope="col">{columnLabel} الحالي</th>
                  <th scope="col">{columnLabel} الجديد</th>
                </tr>
              </thead>
              <tbody>
                {pricingRows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.problem ? "bulk-preview-row--problem" : ""}
                  >
                    <td>{row.name}</td>
                    {showPrice && <td>{row.price ?? "—"}</td>}
                    <td>{row.current ?? "—"}</td>
                    <td>
                      {row.next ?? "—"} {row.next !== null && currency}
                      {row.problem && (
                        <Badge
                          tone="danger"
                          icon={AlertTriangle}
                          className="bulk-preview-problem"
                        >
                          {PREVIEW_PROBLEMS[row.problem]}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ul className="bulk-preview-list">
              {shown.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          )}
          {more > 0 && <p className="bulk-preview-more">+{more} منتج آخر</p>}
        </div>
      )}
    </div>
  );
}
