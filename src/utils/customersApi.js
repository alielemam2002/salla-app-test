import { CUSTOMERS_FUNCTION_URL, getAppId } from "./constants.js";

// Salla limits the customers endpoint to 500 requests per 10 minutes.
export const MAX_CUSTOMER_PAGES = 100;

/**
 * POST to the customers function. Never throws: failures resolve to
 * `{ success: false, status, code, error }`.
 */
async function callCustomersApi(payload) {
  try {
    const response = await fetch(CUSTOMERS_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, appId: getAppId() }),
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
  } catch (error) {
    return {
      success: false,
      status: 0,
      code: "network_error",
      error: error.message,
    };
  }
}

/** Every customer, page after page while Salla returns a `next` page. */
export async function fetchAllCustomers(token) {
  const customers = [];
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= MAX_CUSTOMER_PAGES) {
    const result = await callCustomersApi({ action: "list", token, page });
    if (!result.success) return result;
    customers.push(...(result.customers || []));
    hasMore = Boolean(result.pagination?.next);
    page += 1;
  }
  return { success: true, customers, truncated: hasMore };
}

export function fetchCustomerGroups(token) {
  return callCustomersApi({ action: "groups", token });
}
