import { useEffect, useState } from "react";

/**
 * Pending/error state for the delete confirmation. `onConfirm(id)` must
 * resolve to `{ success, error? }`; the dialog closes on success.
 */
export function useDeleteProductDialog({
  product,
  isOpen,
  onConfirm,
  onClose,
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) setError(null);
  }, [isOpen, product]);

  const confirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const result = await onConfirm(product.id);
      setIsDeleting(false);
      if (!result?.success) {
        setError(result?.error || "تعذّر حذف المنتج من سلة. حاول مرة أخرى.");
      } else {
        onClose();
      }
    } catch (err) {
      setIsDeleting(false);
      setError(err.message || "تعذّر حذف المنتج. حاول مرة أخرى.");
    }
  };

  return { isDeleting, error, confirm };
}
