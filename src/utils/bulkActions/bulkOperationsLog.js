/**
 * Log of bulk operations Salla accepted, kept in this browser's
 * localStorage so the operation ids survive a reload. Salla documents no
 * endpoint to read an operation's status, so the status stored here is the
 * one Salla returned when it accepted the request; it is never changed to
 * "completed" by us.
 */

const STORAGE_KEY = "salla_bulk_operations_v1";
const MAX_ENTRIES = 30;

const listeners = new Set();
let cache = null;

function read() {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(entries) {
  cache = entries.slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or blocked: keep the in-memory list for this session.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeOperations(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOperations() {
  return read();
}

/**
 * Record one submitted bulk action. `operations` is Salla's response data:
 * [{ operation_id, action_name, status }].
 */
export function recordOperation({ label, summary, productCount, operations }) {
  const entry = {
    id: operations[0]?.operation_id || `local-${Date.now()}`,
    label,
    summary,
    productCount,
    createdAt: new Date().toISOString(),
    operations: operations.map((op) => ({
      operation_id: op.operation_id,
      action_name: op.action_name,
      status: op.status,
    })),
  };
  write([entry, ...read().filter((e) => e.id !== entry.id)]);
  return entry;
}

export function clearOperations() {
  write([]);
}

/** Salla status → label + badge tone. Unknown statuses are shown as-is. */
export function operationStatusMeta(status) {
  switch (String(status || "").toLowerCase()) {
    case "in_progress":
    case "queued":
    case "pending":
      return { label: "Processing in Salla", tone: "info" };
    case "completed":
    case "done":
    case "success":
      return { label: "Completed", tone: "success" };
    case "failed":
    case "error":
      return { label: "Failed", tone: "danger" };
    default:
      return { label: status || "Submitted", tone: "neutral" };
  }
}

// Test helper: forget the cached copy so a test can start clean.
export function resetOperationsCache() {
  cache = null;
}
