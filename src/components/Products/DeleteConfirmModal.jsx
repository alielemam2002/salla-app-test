import { Trash2 } from "lucide-react";
import { Alert, ConfirmDialog } from "../ui/index.js";
import { productImage } from "../../utils/productFormat.js";
import { useDeleteProductDialog } from "../../hooks/products/useDeleteProductDialog.js";
import ProductThumb from "./ProductThumb.jsx";

export default function DeleteConfirmModal({
  product,
  isOpen,
  onClose,
  onConfirm,
}) {
  const { isDeleting, error, confirm } = useDeleteProductDialog({
    product,
    isOpen,
    onConfirm,
    onClose,
  });

  if (!product) return null;

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={confirm}
      icon={Trash2}
      tone="danger"
      title="حذف المنتج"
      subtitle="سيتم حذف المنتج من متجرك في سلة"
      confirmText="حذف المنتج"
      loadingText="جارٍ الحذف…"
      loading={isDeleting}
    >
      {error && <Alert tone="error">{error}</Alert>}

      <div className="delete-product-card">
        <ProductThumb src={productImage(product)} size="lg" />
        <div className="delete-product-info">
          <div className="delete-product-name">{product.name}</div>
          <div className="delete-product-meta">
            <span dir="ltr">#{product.id}</span>
            {product.sku ? (
              <>
                {" · SKU: "}
                <span dir="ltr">{product.sku}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <p className="delete-warning-text">
        هل أنت متأكد من حذف هذا المنتج؟ ستحذفه سلة نهائيًا من كتالوج متجرك
        وواجهة المتجر، ولا يمكن التراجع عن ذلك.
      </p>
    </ConfirmDialog>
  );
}
