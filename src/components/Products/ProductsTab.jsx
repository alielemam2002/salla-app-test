import { useState, useEffect, useCallback, useRef } from "react";
import Button from "../forms/Button.jsx";
import ProductModal from "./ProductModal.jsx";
import DeleteConfirmModal from "./DeleteConfirmModal.jsx";
import BulkDiscountModal from "../Discounts/BulkDiscountModal.jsx";
import {
  fetchProductsPage,
  fetchAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchTaxonomies,
} from "../../utils/productsApi.js";
import logger from "../../utils/logger.js";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  Filter,
  Tag,
} from "lucide-react";

const PER_PAGE = 30;

// Setup hints shown for errors the merchant/developer can fix
const ERROR_HINTS = {
  token_not_configured:
    "Add the store's Merchant API access token to Vercel as SALLA_ACCESS_TOKEN, then redeploy.",
  missing_scope:
    "The token works but lacks product permissions. In the Partners Portal enable 'Products Read & Write' (products.read_write), reinstall the app on the store, then put the NEW access_token in SALLA_ACCESS_TOKEN and redeploy.",
  token_expired:
    "SALLA_ACCESS_TOKEN was rejected. Access tokens expire after 14 days: put a fresh token in Vercel and redeploy, and make sure the app has the products scope.",
  session_invalid:
    "The embedded session token is invalid or expired. Refresh the session to get a new one.",
};

function formatPrice(price) {
  if (price == null) return "—";
  if (typeof price === "object") {
    return `${price.amount ?? "—"} ${price.currency ?? ""}`.trim();
  }
  return String(price);
}

function getProductRegularPrice(product) {
  if (!product) return null;
  const reg = product.regular_price;
  const regVal = typeof reg === "object" ? reg?.amount : reg;
  if (
    regVal !== undefined &&
    regVal !== null &&
    regVal !== "" &&
    !isNaN(Number(regVal)) &&
    Number(regVal) > 0
  ) {
    return typeof reg === "object"
      ? reg
      : { amount: Number(regVal), currency: product.price?.currency || "SAR" };
  }
  return product.price;
}

function getProductSalePrice(product) {
  if (!product) return null;
  const sale = product.sale_price;
  const saleVal = typeof sale === "object" ? sale?.amount : sale;
  if (
    saleVal !== undefined &&
    saleVal !== null &&
    saleVal !== "" &&
    !isNaN(Number(saleVal)) &&
    Number(saleVal) > 0
  ) {
    return typeof sale === "object"
      ? sale
      : { amount: Number(saleVal), currency: product.price?.currency || "SAR" };
  }
  return null;
}

export function productImage(product) {
  if (!product) return null;

  // 1. Check if any image in product.images has explicit main/default flag
  if (Array.isArray(product.images) && product.images.length > 0) {
    const mainImg = product.images.find(
      (img) =>
        img &&
        (img.is_main === true ||
          img.main === true ||
          img.default === true ||
          img.is_default === true),
    );
    if (mainImg) {
      const u = mainImg.url || mainImg.original;
      if (u) return u;
    }

    // 2. Check for sort === 1 in images
    const sort1Img = product.images.find(
      (img) => img && Number(img.sort) === 1,
    );
    if (sort1Img) {
      const u = sort1Img.url || sort1Img.original;
      if (u) return u;
    }
  }

  // 3. Check explicit main_image
  if (product.main_image) return product.main_image;

  // 4. Check first item in images array
  if (Array.isArray(product.images) && product.images.length > 0) {
    const firstUrl = product.images[0]?.url || product.images[0]?.original;
    if (firstUrl) return firstUrl;
  }

  // 5. Fallback to thumbnail or image.url
  return product.thumbnail || product.image?.url || null;
}

function ProductRow({
  product,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  isSelected,
  onToggleSelect,
}) {
  const image = productImage(product);
  const stock = product.unlimited_quantity ? "∞" : (product.quantity ?? "—");

  return (
    <>
      <tr
        className={`products-row ${isSelected ? "products-row--selected" : ""}`}
        onClick={() => onToggle(product.id)}
      >
        <td
          className="products-select-col"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(product.id)}
            aria-label={`Select ${product.name}`}
          />
        </td>
        <td className="products-expand-col">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </td>
        <td>
          {image ? (
            <img className="products-thumb" src={image} alt="" loading="lazy" />
          ) : (
            <div className="products-thumb products-thumb--empty" />
          )}
        </td>
        <td>
          <div className="products-name">{product.name}</div>
          <div className="products-meta">
            #{product.id}
            {product.sku ? ` · SKU ${product.sku}` : ""}
            {product.type ? ` · ${product.type}` : ""}
          </div>
        </td>
        <td>
          {(() => {
            const regPrice = getProductRegularPrice(product);
            const salePrice = getProductSalePrice(product);
            const regNum = Number(
              typeof regPrice === "object" ? regPrice?.amount : regPrice,
            );
            const saleNum = Number(
              typeof salePrice === "object" ? salePrice?.amount : salePrice,
            );
            const hasSale = Boolean(
              salePrice &&
                !isNaN(saleNum) &&
                saleNum > 0 &&
                (!isNaN(regNum) ? saleNum < regNum : true),
            );

            if (hasSale) {
              return (
                <div className="products-price-block">
                  <div className="products-price-original">
                    {formatPrice(regPrice)}
                  </div>
                  <div className="products-sale-badge">
                    Sale: {formatPrice(salePrice)}
                  </div>
                </div>
              );
            }

            return (
              <div className="products-price">{formatPrice(product.price)}</div>
            );
          })()}
        </td>
        <td>{stock}</td>
        <td>
          <span
            className={`products-status products-status--${product.status || "default"}`}
          >
            {product.status || "—"}
          </span>
        </td>
        <td
          className="products-actions-col"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="action-icon-btn action-icon-btn--edit"
            onClick={() => onEdit(product)}
            title="Edit product"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            className="action-icon-btn action-icon-btn--delete"
            onClick={() => onDelete(product)}
            title="Delete product"
          >
            <Trash2 size={15} />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="products-details">
          <td colSpan={8}>
            <pre>{JSON.stringify(product, null, 2)}</pre>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ProductsTab({ embedded, showToast }) {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showingAll, setShowingAll] = useState(false);

  // Checkbox Selection State
  const [selectedIds, setSelectedIds] = useState([]);

  // Search & Filter State
  const [keywordInput, setKeywordInput] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkDiscountOpen, setIsBulkDiscountOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [taxonomies, setTaxonomies] = useState({ categories: [], brands: [] });

  const requestIdRef = useRef(0);

  const getToken = useCallback(
    () => embedded?.auth?.getToken?.() || null,
    [embedded],
  );

  const handleFailure = useCallback((result) => {
    logger.error("Products operation failed:", result);
    setError({ code: result.code, message: result.error });
  }, []);

  // Fetch taxonomies (categories & brands) once on token ready
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetchTaxonomies(token)
      .then((res) => {
        if (res.success) {
          setTaxonomies({
            categories: res.categories || [],
            brands: res.brands || [],
          });
        }
      })
      .catch((err) => {
        logger.warn("Could not load taxonomies:", err);
      });
  }, [getToken]);

  const loadPage = useCallback(
    async (
      targetPage,
      searchKeyword = appliedKeyword,
      filterStatus = statusFilter,
    ) => {
      const token = getToken();
      if (!token) {
        setError({
          code: "no_token",
          message:
            "No embedded token found. Open this app from the Salla dashboard.",
        });
        setIsLoading(false);
        return;
      }

      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);
      setProgress(null);

      const result = await fetchProductsPage(token, {
        page: targetPage,
        perPage: PER_PAGE,
        keyword: searchKeyword || undefined,
        status: filterStatus || undefined,
      });

      if (requestId !== requestIdRef.current) return; // stale response

      if (result.success) {
        setProducts(result.products || []);
        setPagination(result.pagination);
        setPage(targetPage);
        setShowingAll(false);
      } else {
        handleFailure(result);
      }
      setIsLoading(false);
    },
    [getToken, appliedKeyword, statusFilter, handleFailure],
  );

  const loadAll = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    setProgress({ page: 0, totalPages: pagination?.totalPages || "?" });

    const result = await fetchAllProducts(token, {
      perPage: PER_PAGE,
      keyword: appliedKeyword || undefined,
      status: statusFilter || undefined,
      onProgress: (p) => {
        if (requestId === requestIdRef.current) setProgress(p);
      },
    });
    if (requestId !== requestIdRef.current) return;

    if (result.success) {
      setProducts(result.products);
      setPagination(result.pagination);
      setShowingAll(true);
      showToast?.(`Loaded all ${result.products.length} products`, "success");
    } else {
      handleFailure(result);
    }
    setProgress(null);
    setIsLoading(false);
  }, [
    getToken,
    pagination,
    appliedKeyword,
    statusFilter,
    showToast,
    handleFailure,
  ]);

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  // Checkbox selection handlers
  const handleToggleSelectProduct = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    const currentPageIds = products.map((p) => p.id);
    const allSelected =
      currentPageIds.length > 0 &&
      currentPageIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !currentPageIds.includes(id)),
      );
    } else {
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...currentPageIds])),
      );
    }
  }, [products, selectedIds]);

  const isAllSelected =
    products.length > 0 && products.every((p) => selectedIds.includes(p.id));
  const isSomeSelected =
    products.some((p) => selectedIds.includes(p.id)) && !isAllSelected;

  // Handle Search Submission
  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const trimmed = keywordInput.trim();
    setAppliedKeyword(trimmed);
    loadPage(1, trimmed, statusFilter);
  };

  const handleClearSearch = () => {
    setKeywordInput("");
    setAppliedKeyword("");
    loadPage(1, "", statusFilter);
  };

  const handleStatusFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    loadPage(1, appliedKeyword, newStatus);
  };

  const toggleExpanded = useCallback((id) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  // CRUD Operations Handlers
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (product) => {
    setDeletingProduct(product);
  };

  const handleSaveProduct = async (payload, productId) => {
    const token = getToken();
    if (!token) {
      return { success: false, error: "Authentication token missing" };
    }

    if (productId) {
      // Update
      const res = await updateProduct(token, productId, payload);
      if (res.success && res.product) {
        const chosenMainImage =
          payload.main_image ||
          (Array.isArray(payload.images) && payload.images.length > 0
            ? payload.images.find(
                (img) => img.default || img.is_main || img.main,
              )?.original || payload.images[0]?.original
            : null);

        setProducts((prev) =>
          prev.map((p) => {
            if (p.id !== productId) return p;
            const updated = { ...p, ...res.product };
            if (payload.images && Array.isArray(payload.images)) {
              updated.images = payload.images;
            }
            if (chosenMainImage) {
              updated.main_image = chosenMainImage;
              updated.thumbnail = chosenMainImage;
            }
            return updated;
          }),
        );
        showToast?.(
          `Product "${res.product.name || productId}" updated successfully`,
          "success",
        );
      }
      return res;
    } else {
      // Create
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
    }
  };

  const handleDeleteProduct = async (productId) => {
    const token = getToken();
    if (!token) {
      return { success: false, error: "Authentication token missing" };
    }

    const res = await deleteProduct(token, productId);
    if (res.success) {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setSelectedIds((prev) => prev.filter((id) => id !== productId));
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
  };

  // Bulk Discount Success Handler
  const handleBulkSuccess = useCallback(
    ({ payload, mode }) => {
      // Update in-memory products state
      setProducts((currentProducts) =>
        currentProducts.map((p) => {
          const updated = payload.find(
            (item) => Number(item.id) === Number(p.id),
          );
          if (!updated) return p;

          const baseRegular = p.regular_price || p.price;
          const currency =
            typeof baseRegular === "object"
              ? baseRegular.currency || "SAR"
              : "SAR";

          if (mode === "apply") {
            return {
              ...p,
              regular_price: baseRegular,
              price: {
                amount: updated.sale_price,
                currency,
              },
              sale_price: {
                amount: updated.sale_price,
                currency,
              },
            };
          } else {
            return {
              ...p,
              price: baseRegular,
              regular_price: null,
              sale_price: null,
            };
          }
        }),
      );

      setSelectedIds([]);

      // Trigger background sync after a brief delay to allow Salla async queue to process
      setTimeout(() => {
        loadPage(page);
      }, 1500);
    },
    [loadPage, page],
  );

  const totalPages = pagination?.totalPages || 1;
  const total = pagination?.total ?? products.length;

  const header = (
    <div className="panel-header">
      <div>
        <h2 className="panel-title">Products Management</h2>
        <span className="panel-subtitle">
          Full CRUD & Bulk Discounts on Salla Admin API
        </span>
      </div>
      <div className="panel-actions">
        <Button
          variant="accent"
          onClick={() => setIsBulkDiscountOpen(true)}
          disabled={isLoading}
        >
          <Tag size={16} />
          {selectedIds.length > 0
            ? `Bulk Discount (${selectedIds.length})`
            : "Bulk Discount"}
        </Button>
        <Button variant="primary" onClick={handleOpenAdd} disabled={isLoading}>
          <Plus size={16} /> Add Product
        </Button>
        <Button
          onClick={() => loadPage(showingAll ? 1 : page)}
          disabled={isLoading}
        >
          Refresh
        </Button>
        <Button onClick={loadAll} disabled={isLoading || !!error}>
          Fetch all
        </Button>
      </div>
    </div>
  );

  const searchToolbar = (
    <div className="products-toolbar">
      <form onSubmit={handleSearchSubmit} className="products-search-wrap">
        <Search size={16} className="products-search-icon" />
        <input
          type="text"
          className="products-search-input"
          placeholder="Search by name or SKU..."
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
        />
        {keywordInput && (
          <button
            type="button"
            className="products-search-clear"
            onClick={handleClearSearch}
            title="Clear search"
          >
            <X size={14} />
          </button>
        )}
        <Button size="small" type="submit" disabled={isLoading}>
          Search
        </Button>
      </form>

      <div className="products-filter-wrap">
        <Filter size={15} className="products-filter-icon" />
        <select
          className="products-filter-select"
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value)}
          disabled={isLoading}
        >
          <option value="">All Statuses</option>
          <option value="sale">Active (Sale)</option>
          <option value="out">Out of Stock</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>
    </div>
  );

  let content;
  if (isLoading && !products.length) {
    content = (
      <div className="products-state">
        {progress
          ? `Loading page ${progress.page} of ${progress.totalPages}… (${progress.loaded ?? 0} products)`
          : "Loading products..."}
      </div>
    );
  } else if (error) {
    content = (
      <div className="products-state products-state--error">
        <p>Failed to load products: {error.message}</p>
        {ERROR_HINTS[error.code] && (
          <p className="products-hint">{ERROR_HINTS[error.code]}</p>
        )}
        <div className="panel-actions">
          {error.code === "session_invalid" && (
            <Button variant="primary" onClick={() => embedded?.auth?.refresh()}>
              Refresh session
            </Button>
          )}
          <Button onClick={() => loadPage(page)}>Retry</Button>
        </div>
      </div>
    );
  } else if (!products.length) {
    content = (
      <div className="products-state">
        <p>
          {appliedKeyword || statusFilter
            ? "No products found matching your search filter."
            : "This store has no products."}
        </p>
        {(appliedKeyword || statusFilter) && (
          <Button size="small" onClick={handleClearSearch}>
            Clear Filters
          </Button>
        )}
      </div>
    );
  } else {
    content = (
      <>
        {/* Selection Bar Banner */}
        {selectedIds.length > 0 && (
          <div className="products-selection-bar">
            <div className="products-selection-info">
              <strong>{selectedIds.length}</strong> products selected
            </div>
            <div className="products-selection-actions">
              <Button
                size="small"
                variant="accent"
                onClick={() => setIsBulkDiscountOpen(true)}
              >
                <Tag size={14} /> Bulk Discount ({selectedIds.length})
              </Button>
              <Button size="small" onClick={() => setSelectedIds([])}>
                Deselect all
              </Button>
            </div>
          </div>
        )}

        <div className="products-summary">
          <span>
            {showingAll
              ? `Showing all ${products.length} products`
              : `Showing ${products.length} of ${total} products · page ${page} of ${totalPages}`}
          </span>
          {appliedKeyword && (
            <span className="products-filter-tag">
              Keyword: &quot;{appliedKeyword}&quot;
            </span>
          )}
          {statusFilter && (
            <span className="products-filter-tag">Status: {statusFilter}</span>
          )}
        </div>

        <div className="products-table-wrapper">
          <table className="products-table">
            <thead>
              <tr>
                <th style={{ width: 36 }} className="products-select-col">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={handleToggleSelectAll}
                    aria-label="Select all on this page"
                  />
                </th>
                <th style={{ width: 32 }} />
                <th style={{ width: 60 }}>Thumbnail</th>
                <th>Product</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th style={{ width: 100, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  expanded={expandedId === product.id}
                  onToggle={toggleExpanded}
                  onEdit={handleOpenEdit}
                  onDelete={handleOpenDelete}
                  isSelected={selectedIds.includes(product.id)}
                  onToggleSelect={handleToggleSelectProduct}
                />
              ))}
            </tbody>
          </table>
        </div>

        {!showingAll && totalPages > 1 && (
          <div className="products-pagination">
            <Button
              size="small"
              onClick={() => loadPage(page - 1)}
              disabled={page <= 1 || isLoading}
            >
              Previous
            </Button>
            <span>
              Page {page} / {totalPages}
            </span>
            <Button
              size="small"
              onClick={() => loadPage(page + 1)}
              disabled={page >= totalPages || isLoading}
            >
              Next
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="products-container">
      <div className="panel">
        {header}
        {searchToolbar}
        {content}
      </div>

      {/* Add / Edit Product Modal Form */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProduct}
        product={editingProduct}
        taxonomies={taxonomies}
      />

      {/* Delete Product Confirmation Dialog */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingProduct)}
        product={deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onConfirm={handleDeleteProduct}
      />

      {/* Bulk Discount Modal */}
      <BulkDiscountModal
        isOpen={isBulkDiscountOpen}
        onClose={() => setIsBulkDiscountOpen(false)}
        selectedProducts={products.filter((p) => selectedIds.includes(p.id))}
        allLoadedProducts={products}
        totalStoreProducts={pagination?.total ?? products.length}
        categories={taxonomies.categories}
        token={getToken()}
        onSuccess={handleBulkSuccess}
        showToast={showToast}
      />
    </div>
  );
}
