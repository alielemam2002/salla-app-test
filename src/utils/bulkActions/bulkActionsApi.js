import { PRODUCTS_FUNCTION_URL, getAppId } from "../constants.js";
import { buildFilters, buildOperation } from "./bulkActionSpec.js";

/**
 * The one entry point for Salla Bulk Product Actions. Components pass the
 * action and form values; this builds the documented payload and sends it
 * through api/products.js (which validates it again) to POST /products/actions.
 *
 * Never throws: resolves to `{ success: true, operations }` or
 * `{ success: false, status, code, error, fields? }`.
 */
export async function executeBulkProductAction({
  token,
  actionName,
  value,
  selection,
}) {
  const { operation, error } = buildOperation(actionName, value);
  if (error) {
    return { success: false, status: 422, code: "validation_failed", error };
  }
  try {
    const response = await fetch(PRODUCTS_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "bulk_actions",
        token,
        appId: getAppId(),
        operations: [operation],
        filters: buildFilters(selection),
      }),
    });
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return json.success ? json : { status: response.status, ...json };
    } catch {
      return {
        success: false,
        status: response.status,
        code: "bad_response",
        error: `Server returned non-JSON (status ${response.status})`,
      };
    }
  } catch (err) {
    return {
      success: false,
      status: 0,
      code: "network_error",
      error: err.message,
    };
  }
}
