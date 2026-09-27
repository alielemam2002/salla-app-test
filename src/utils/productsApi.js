import { PRODUCTS_FUNCTION_URL, getAppId } from "./constants.js";

/**
 * Fetch one page of the store's products via the Vercel function.
 * The embedded token identifies the merchant; the server holds the
 * Merchant API access token.
 *
 * @returns {Promise<{ success: boolean, products?: object[], pagination?: object, code?: string, error?: string }>}
 */
export async function fetchProductsPage(
  token,
  { page = 1, perPage = 30 } = {},
) {
  try {
    const response = await fetch(PRODUCTS_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, appId: getAppId(), page, perPage }),
    });

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return {
        success: false,
        code: "bad_response",
        error: `Server returned non-JSON (status ${response.status})`,
      };
    }
  } catch (error) {
    return { success: false, code: "network_error", error: error.message };
  }
}

/**
 * Fetch every page sequentially (Salla rate limits per store, so no parallel
 * requests). Calls onProgress after each page.
 */
export async function fetchAllProducts(
  token,
  { perPage = 60, onProgress } = {},
) {
  const all = [];
  let page = 1;
  let totalPages = 1;
  let pagination = null;

  do {
    const result = await fetchProductsPage(token, { page, perPage });
    if (!result.success) return { ...result, products: all, pagination };

    all.push(...(result.products || []));
    pagination = result.pagination;
    totalPages = result.pagination?.totalPages || page;
    onProgress?.({ page, totalPages, loaded: all.length });
    page += 1;
  } while (page <= totalPages);

  return { success: true, products: all, pagination };
}
