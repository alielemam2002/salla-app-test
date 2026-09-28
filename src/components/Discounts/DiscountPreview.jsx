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
        title={`Sample Preview (${rows.length} items)`}
        actions={
          <Badge tone="primary">Target: {estimatedTargetCount} products</Badge>
        }
      />

      <div className="preview-table-wrap">
        <table className="preview-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Regular Price</th>
              {isApply && <th>Discount</th>}
              <th>{isApply ? "New Sale Price" : "Restored Price"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="preview-empty">
                  No sample products available for this target.
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
                          Replaces current sale ({row.currentSale} SAR)
                        </span>
                      )}
                    </div>
                  </td>
                  <td data-label="Regular">{row.regularPrice} SAR</td>
                  {isApply && (
                    <td data-label="Discount" className="preview-discount-col">
                      {discountLabel}
                    </td>
                  )}
                  <td data-label={isApply ? "New" : "Restored"}>
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
