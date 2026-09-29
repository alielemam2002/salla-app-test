import { useSyncExternalStore } from "react";
import {
  clearOperations,
  getOperations,
  subscribeOperations,
} from "../../utils/bulkActions/bulkOperationsLog.js";

/**
 * Bulk operations Salla accepted (newest first), from this browser's log.
 * Local data, not server state: Salla has no endpoint to list or poll them.
 */
export function useBulkOperations() {
  const operations = useSyncExternalStore(
    subscribeOperations,
    getOperations,
    getOperations,
  );
  return { operations, clear: clearOperations };
}
