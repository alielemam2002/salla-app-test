import { useState } from "react";
import Button from "../forms/Button.jsx";
import { AlertCircle, Trash2, X } from "lucide-react";

export default function DeleteConfirmModal({
  product,
  isOpen,
  onClose,
  onConfirm,
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !product) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const result = await onConfirm(product.id);
      if (!result?.success) {
        setError(result?.error || "Failed to delete product from Salla");
        setIsDeleting(false);
      } else {
        setIsDeleting(false);
        onClose();
      }
    } catch (err) {
      setError(err.message || "Failed to delete product");
      setIsDeleting(false);
    }
  };

  const mainImageFromList =
    Array.isArray(product?.images) && product.images.length > 0
      ? product.images.find(
          (img) =>
            img &&
            (img.is_main === true ||
              img.main === true ||
              img.default === true ||
              img.is_default === true),
        ) ||
        product.images.find((img) => img && Number(img.sort) === 1) ||
        product.images[0]
      : null;

  const image =
    mainImageFromList?.url ||
    mainImageFromList?.original ||
    product?.main_image ||
    product?.thumbnail ||
    null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content modal-content--sm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge modal-icon-badge--danger">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 id="delete-dialog-title" className="modal-title">
                Delete Product
              </h3>
              <span className="modal-subtitle">
                This will remove the product from your Salla store
              </span>
            </div>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="form-alert form-alert--error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="delete-product-card">
            {image ? (
              <img src={image} alt="" className="delete-product-thumb" />
            ) : (
              <div className="delete-product-thumb delete-product-thumb--empty" />
            )}
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
        </div>

        <div className="modal-footer">
          <Button onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Product"}
          </Button>
        </div>
      </div>
    </div>
  );
}
