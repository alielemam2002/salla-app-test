import { PRODUCTS_FUNCTION_URL, getAppId } from "./constants.js";

/**
 * Common fetch helper for calling the Vercel serverless function.
 * @param {object} payload
 * @returns {Promise<any>}
 */
async function callProductsApi(payload) {
  try {
    const response = await fetch(PRODUCTS_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
 * Fetch one page of the store's products via the Vercel function.
 * The embedded token identifies the merchant; the server holds the
 * Merchant API access token.
 *
 * @returns {Promise<{ success: boolean, products?: object[], pagination?: object, code?: string, error?: string }>}
 */
export async function fetchProductsPage(
  token,
  { page = 1, perPage = 30, keyword, status, category } = {},
) {
  const payload = { token, appId: getAppId(), page, perPage };
  if (keyword) payload.keyword = keyword;
  if (status) payload.status = status;
  if (category) payload.category = category;
  return callProductsApi(payload);
}

/**
 * Fetch every page sequentially (Salla rate limits per store, so no parallel
 * requests). Calls onProgress after each page.
 */
export async function fetchAllProducts(
  token,
  { perPage = 60, onProgress, keyword, status, category } = {},
) {
  const all = [];
  let page = 1;
  let totalPages = 1;
  let pagination = null;

  do {
    const result = await fetchProductsPage(token, {
      page,
      perPage,
      keyword,
      status,
      category,
    });
    if (!result.success) return { ...result, products: all, pagination };

    all.push(...(result.products || []));
    pagination = result.pagination;
    totalPages = result.pagination?.totalPages || page;
    onProgress?.({ page, totalPages, loaded: all.length });
    page += 1;
  } while (page <= totalPages);

  return { success: true, products: all, pagination };
}

/**
 * Create a new product in the Salla store.
 * @param {string} token - Embedded session token
 * @param {object} productData - Product fields (name, price, product_type, etc.)
 */
export async function createProduct(token, productData) {
  return callProductsApi({
    action: "create",
    token,
    appId: getAppId(),
    productData,
  });
}

/**
 * Update an existing product in the Salla store.
 * @param {string} token - Embedded session token
 * @param {string|number} productId - Product ID
 * @param {object} productData - Updated product fields
 */
export async function updateProduct(token, productId, productData) {
  return callProductsApi({
    action: "update",
    token,
    appId: getAppId(),
    productId,
    productData,
  });
}

/**
 * Delete a product from the Salla store.
 * @param {string} token - Embedded session token
 * @param {string|number} productId - Product ID
 */
export async function deleteProduct(token, productId) {
  return callProductsApi({
    action: "delete",
    token,
    appId: getAppId(),
    productId,
  });
}

/**
 * Get detailed information for a single product.
 * @param {string} token - Embedded session token
 * @param {string|number} productId - Product ID
 */
export async function getProductDetails(token, productId) {
  return callProductsApi({
    action: "get",
    token,
    appId: getAppId(),
    productId,
  });
}

/**
 * Fetch available categories and brands for product form selectors.
 * @param {string} token - Embedded session token
 */
export async function fetchTaxonomies(token) {
  return callProductsApi({
    action: "taxonomies",
    token,
    appId: getAppId(),
  });
}

/**
 * Update multiple product prices and discounts at once (Bulk Price).
 * @param {string} token - Embedded session token
 * @param {Array<object>} products - Array of { id, price, sale_price, sale_end }
 */
export async function bulkUpdateProductPrices(token, products) {
  return callProductsApi({
    action: "bulk_price",
    token,
    appId: getAppId(),
    products,
  });
}

/**
 * Fetch product options.
 */
export async function fetchProductOptions(token, productId) {
  return callProductsApi({
    action: "options_list",
    token,
    appId: getAppId(),
    productId,
  });
}

/**
 * Create a new option for a product.
 */
export async function createProductOption(token, productId, optionData) {
  return callProductsApi({
    action: "option_create",
    token,
    appId: getAppId(),
    productId,
    optionData,
  });
}

/**
 * Update an existing option.
 */
export async function updateProductOption(token, productId, optionId, optionData) {
  return callProductsApi({
    action: "option_update",
    token,
    appId: getAppId(),
    productId,
    optionId,
    optionData,
  });
}

/**
 * Delete an option.
 */
export async function deleteProductOption(token, productId, optionId) {
  return callProductsApi({
    action: "option_delete",
    token,
    appId: getAppId(),
    productId,
    optionId,
  });
}

/**
 * Fetch variants / SKUs for a product.
 */
export async function fetchProductVariants(token, productId) {
  return callProductsApi({
    action: "variants_list",
    token,
    appId: getAppId(),
    productId,
  });
}

/**
 * Update a product variant.
 */
export async function updateProductVariant(token, productId, variantId, variantData) {
  return callProductsApi({
    action: "variant_update",
    token,
    appId: getAppId(),
    productId,
    variantId,
    variantData,
  });
}

/**
 * Fetch product images.
 */
export async function fetchProductImages(token, productId) {
  return callProductsApi({
    action: "images_list",
    token,
    appId: getAppId(),
    productId,
  });
}

/**
 * Upload an image to a product.
 */
export async function uploadProductImage(token, productId, imageData) {
  return callProductsApi({
    action: "image_upload",
    token,
    appId: getAppId(),
    productId,
    imageData,
  });
}

/**
 * Delete an image from a product.
 */
export async function deleteProductImage(token, productId, imageId) {
  return callProductsApi({
    action: "image_delete",
    token,
    appId: getAppId(),
    productId,
    imageId,
  });
}

