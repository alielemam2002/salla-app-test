import { useCallback } from "react";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "../../utils/productsApi.js";
import {
  applyBulkResultToProducts,
  mergeUpdatedProduct,
} from "../../utils/productListUpdates.js";

const MISSING_TOKEN = { success: false, error: "Authentication token missing" };

/**
 * Create / update / delete against the Salla API, keeping the in-memory list
 * in sync. Each call resolves to the API result (`{ success, error?, ... }`).
 */
export function useProductMutations({ getToken, list, selection, showToast }) {
  const { setProducts, setPagination, loadPage, page } = list;
  const { remove: unselect, clear: clearSelection } = selection;

  const saveProduct = useCallback(
    async (payload, productId) => {
      const token = getToken();
      if (!token) return MISSING_TOKEN;

      if (productId) {
        const res = await updateProduct(token, productId, payload);
        if (res.success && res.product) {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === productId
                ? mergeUpdatedProduct(p, res.product, payload)
                : p,
            ),
          );
          showToast?.(
            `Product "${res.product.name || productId}" updated successfully`,
            "success",
          );
        }
        return res;
      }

      const res = await createProduct(token, payload);
      if (res.success && res.product) {
        setProducts((prev) => [res.product, ...prev]);
        showToast?.(
          `Product "${res.product.name}" created successfully`,
          "success",
        );
        loadPage(1);
      }
      return res;
    },
    [getToken, setProducts, showToast, loadPage],
  );

  const removeProduct = useCallback(
    async (productId) => {
      const token = getToken();
      if (!token) return MISSING_TOKEN;

      const res = await deleteProduct(token, productId);
      if (res.success) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        unselect(productId);
        setPagination((prev) =>
          prev
            ? {
                ...prev,
                total: Math.max(0, (prev.total || 1) - 1),
                count: Math.max(0, (prev.count || 1) - 1),
              }
            : null,
        );
        showToast?.("Product deleted successfully", "success");
      }
      return res;
    },
    [getToken, setProducts, unselect, setPagination, showToast],
  );

  const handleBulkSuccess = useCallback(
    ({ payload, mode }) => {
      setProducts((current) =>
        applyBulkResultToProducts(current, payload, mode),
      );
      clearSelection();
      // Give Salla's async queue a moment before re-syncing
      setTimeout(() => {
        loadPage(page);
      }, 1500);
    },
    [setProducts, clearSelection, loadPage, page],
  );

  return { saveProduct, removeProduct, handleBulkSuccess };
}
