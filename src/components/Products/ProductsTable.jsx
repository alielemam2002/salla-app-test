import { useState } from "react";
import ProductRow from "./ProductRow.jsx";

const COLUMN_COUNT = 8;

/**
 * Products table. Collapses to stacked cards on narrow screens (CSS only,
 * so each value is rendered once).
 */
export default function ProductsTable({
  products,
  selection,
  onEdit,
  onOpenEditor,
  onDelete,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const toggleExpand = (id) =>
    setExpandedId((current) => (current === id ? null : id));

  return (
    <div className="products-table-wrapper">
      <table className="products-table">
        <thead>
          <tr>
            <th className="products-select-col">
              <input
                type="checkbox"
                checked={selection.isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = selection.isSomeSelected;
                }}
                onChange={selection.toggleAll}
                aria-label="تحديد كل منتجات هذه الصفحة"
              />
            </th>
            <th className="products-expand-col">
              <span className="sr-only">التفاصيل</span>
            </th>
            <th className="products-thumb-col">
              <span className="sr-only">الصورة</span>
            </th>
            <th>المنتج</th>
            <th>السعر</th>
            <th>المخزون</th>
            <th>الحالة</th>
            <th className="products-actions-col">الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              expanded={expandedId === product.id}
              isSelected={selection.isSelected(product.id)}
              onToggleExpand={toggleExpand}
              onToggleSelect={selection.toggle}
              onEdit={onEdit}
              onOpenEditor={onOpenEditor}
              onDelete={onDelete}
              columnCount={COLUMN_COUNT}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
