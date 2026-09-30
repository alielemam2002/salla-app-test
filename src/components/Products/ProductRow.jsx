import {
  ChevronDown,
  ChevronLeft,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge, CodeBlock, IconButton, cx } from "../ui/index.js";
import { formatStock, productImage } from "../../utils/productFormat.js";
import {
  PRODUCT_STATUS_TONES,
  productTypeLabel,
  statusLabel,
} from "../../utils/productConstants.js";
import ProductThumb from "./ProductThumb.jsx";
import ProductPrice from "./ProductPrice.jsx";

const stop = (e) => e.stopPropagation();

/** One table row plus its expandable raw-JSON details row. */
export default function ProductRow({
  product,
  expanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
  onEdit,
  onOpenEditor,
  onDelete,
  columnCount,
}) {
  const ExpandIcon = expanded ? ChevronDown : ChevronLeft;

  return (
    <>
      <tr
        className={cx("products-row", isSelected && "products-row--selected")}
        onClick={() => onToggleExpand(product.id)}
        aria-expanded={expanded}
      >
        <td className="products-select-col" onClick={stop}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(product.id)}
            aria-label={`تحديد ${product.name}`}
          />
        </td>
        <td className="products-expand-col" aria-hidden="true">
          <ExpandIcon size={16} />
        </td>
        <td className="products-thumb-col">
          <ProductThumb src={productImage(product)} />
        </td>
        <td className="products-name-col">
          <button
            type="button"
            className="products-name products-name--clickable"
            onClick={(e) => {
              stop(e);
              onOpenEditor(product);
            }}
            title="فتح تفاصيل المنتج ونسبة الاكتمال"
          >
            {product.name}
          </button>
          <div className="products-meta">
            <span dir="ltr">#{product.id}</span>
            {product.sku ? (
              <>
                {" · SKU "}
                <span dir="ltr">{product.sku}</span>
              </>
            ) : null}
            {product.type ? ` · ${productTypeLabel(product.type)}` : ""}
          </div>
        </td>
        <td data-label="السعر">
          <ProductPrice product={product} />
        </td>
        <td data-label="المخزون" className="products-stock">
          {formatStock(product)}
        </td>
        <td data-label="الحالة">
          <Badge tone={PRODUCT_STATUS_TONES[product.status] || "neutral"} dot>
            {statusLabel(product.status)}
          </Badge>
        </td>
        <td className="products-actions-col" onClick={stop}>
          <div className="products-actions">
            <IconButton
              icon={Sparkles}
              label="المحرر المتكامل ونسبة الاكتمال"
              tone="primary"
              className="products-editor-btn"
              onClick={() => onOpenEditor(product)}
            />
            <IconButton
              icon={Pencil}
              label={`تعديل ${product.name}`}
              tone="primary"
              onClick={() => onEdit(product)}
            />
            <IconButton
              icon={Trash2}
              label={`حذف ${product.name}`}
              tone="danger"
              onClick={() => onDelete(product)}
            />
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="products-details">
          <td colSpan={columnCount}>
            <CodeBlock value={product} maxHeight={360} />
          </td>
        </tr>
      )}
    </>
  );
}
