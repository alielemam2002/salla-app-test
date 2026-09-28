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
      title="Delete Product"
      subtitle="This will remove the product from your Salla store"
      confirmText="Delete Product"
      loadingText="Deleting..."
      loading={isDeleting}
    >
      {error && <Alert tone="error">{error}</Alert>}

      <div className="delete-product-card">
        <ProductThumb src={productImage(product)} size="lg" />
        <div className="delete-product-info">
          <div className="delete-product-name">{product.name}</div>
          <div className="delete-product-meta">
            ID: #{product.id}
            {product.sku ? ` · SKU: ${product.sku}` : ""}
          </div>
        </div>
      </div>

      <p className="delete-warning-text">
        Are you sure you want to delete this product? Salla will permanently
        remove it from your catalog and storefront.
      </p>
    </ConfirmDialog>
  );
}
