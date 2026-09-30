import { useMutation, useQueryClient } from "@tanstack/react-query";
import { executeBulkProductAction } from "../../utils/bulkActions/bulkActionsApi.js";
import { recordOperation } from "../../utils/bulkActions/bulkOperationsLog.js";
import { productKeys } from "../useProductQueries.js";

/** Error that keeps the API result so the UI can describe it. */
export class BulkActionError extends Error {
  constructor(result) {
    super(result?.error || "تعذّر تنفيذ الإجراء الجماعي");
    this.name = "BulkActionError";
    this.result = result;
  }
}

/**
 * Submit one Salla bulk action (POST /products/actions).
 * Variables: { actionName, value, selection, label, summary, productCount }.
 * On success the accepted operation ids are logged. Cached product details
 * are marked stale, but nothing is shown as updated: several products are
 * processed later by Salla's queue.
 */
export function useBulkProductAction(getToken) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ actionName, value, selection }) => {
      const token = getToken();
      if (!token) {
        throw new BulkActionError({
          status: 401,
          code: "session_invalid",
          error: "لم يتم العثور على رمز الجلسة",
        });
      }
      const result = await executeBulkProductAction({
        token,
        actionName,
        value,
        selection,
      });
      if (!result.success) throw new BulkActionError(result);
      return result.operations || [];
    },
    onSuccess: (operations, { label, summary, productCount }) => {
      recordOperation({ label, summary, productCount, operations });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}
