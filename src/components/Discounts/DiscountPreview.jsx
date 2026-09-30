import { Sparkles } from "lucide-react";
import { Badge, SectionHeader } from "../ui/index.js";

/** Sample of affected products with their current and resulting prices. */
export default function DiscountPreview({
  rows,
  mode,
  discountType,
  discountValue,
  estimatedTargetCount,
}) {
  const isApply = mode === "apply";
  const valNum = Number(discountValue);
  const discountLabel =
    discountType === "percentage" ? `-${valNum}%` : `-${valNum} SAR`;

  return (
    <section className="form-section">
      <SectionHeader
        icon={Sparkles}
        title={`معاينة عيّنة (${rows.length} منتج)`}
        actions={
          <Badge tone="primary">المستهدف: {estimatedTargetCount} منتج</Badge>
        }
      />

      <div className="preview-table-wrap">
        <table className="preview-table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>السعر الأساسي</th>
              {isApply && <th>الخصم</th>}
              <th>{isApply ? "سعر التخفيض الجديد" : "السعر بعد الإعادة"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="preview-empty">
                  لا توجد منتجات للمعاينة ضمن هذا النطاق.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="preview-product-name">{row.name}</div>
                    <div className="preview-product-meta">
                      #{row.id}
                      {row.hasCurrentSale && isApply && (
                        <span className="preview-replace-tag">
                          يستبدل سعر التخفيض الحالي ({row.currentSale} SAR)
                        </span>
                      )}
                    </div>
                  </td>
                  <td data-label="الأساسي">{row.regularPrice} SAR</td>
                  {isApply && (
                    <td
                      data-label="الخصم"
                      className="preview-discount-col"
                      dir="ltr"
                    >
                      {discountLabel}
                    </td>
                  )}
                  <td data-label={isApply ? "الجديد" : "المُعاد"}>
                    <strong className="preview-new-price">
                      {row.newPrice} SAR
                    </strong>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
