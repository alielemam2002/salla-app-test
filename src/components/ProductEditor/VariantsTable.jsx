import { Pencil } from "lucide-react";
import { Badge, Button, EmptyState, Spinner } from "../ui/index.js";
import { amountOf, variantLabel } from "../../utils/productEditorForm.js";

const withCurrency = (v) => (v ? `${v} ر.س` : "—");

/** SKU/variant table with per-row edit action. */
export default function VariantsTable({ variants = [], isLoading, onEdit }) {
  if (isLoading) {
    return <Spinner label="جارِ جلب متغيرات المنتج..." />;
  }
  if (variants.length === 0) {
    return (
      <EmptyState
        className="editor-sub-empty"
        title="هذا المنتج منتج بسيط لا يحتوي على متغيرات (Variants)."
        description="عند إضافة خيارات متعددة، ستقوم سلة تلقائيًا بإنشاء جدول المتغيرات هنا."
      />
    );
  }

  return (
    <div className="variants-table-wrapper">
      <table className="variants-table">
        <thead>
          <tr>
            <th scope="col">المتغير / الخيار</th>
            <th scope="col">رمز SKU</th>
            <th scope="col">السعر (ر.س)</th>
            <th scope="col">سعر الخصم</th>
            <th scope="col">سعر التكلفة</th>
            <th scope="col">المخزون</th>
            <th scope="col">GTIN</th>
            <th scope="col">
              <span className="sr-only">إجراء</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => {
            const stock = v.stock_quantity ?? v.quantity ?? "—";
            return (
              <tr key={v.id}>
                <th scope="row" className="variant-name-cell">
                  {variantLabel(v)}
                </th>
                <td dir="ltr">{v.sku || "—"}</td>
                <td className="variant-price-cell">
                  {amountOf(v.price) ?? "—"}
                </td>
                <td>{withCurrency(amountOf(v.sale_price))}</td>
                <td>{withCurrency(amountOf(v.cost_price))}</td>
                <td>
                  <Badge tone={Number(stock) > 0 ? "success" : "danger"}>
                    {stock}
                  </Badge>
                </td>
                <td dir="ltr">{v.gtin || v.barcode || "—"}</td>
                <td>
                  <Button
                    size="small"
                    variant="ghost"
                    icon={Pencil}
                    onClick={() => onEdit(v)}
                    title="تعديل بيانات المتغير"
                  >
                    تعديل
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
