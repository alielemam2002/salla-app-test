import { useState, useEffect, useCallback, useRef } from "react";
import Button from "../forms/Button.jsx";
import ProductModal from "./ProductModal.jsx";
import DeleteConfirmModal from "./DeleteConfirmModal.jsx";
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

function productImage(product) {
  return (
    product.thumbnail ||
    product.main_image ||
    product.images?.[0]?.url ||
    product.images?.[0]?.original ||
    product.image?.url ||
    null
  );
}

function ProductRow({ product, expanded, onToggle, onEdit, onDelete }) {
  const image = productImage(product);
  const stock = product.unlimited_quantity ? "∞" : (product.quantity ?? "—");

  return (
    <>
      <tr className="products-row" onClick={() => onToggle(product.id)}>
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
          <div className="products-price">{formatPrice(product.price)}</div>
          {product.sale_price?.amount ? (
            <div className="products-sale-badge">
              Sale: {formatPrice(product.sale_price)}
            </div>
          ) : null}
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
          <td colSpan={7}>
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

  // Search & Filter State
  const [keywordInput, setKeywordInput] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
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
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, ...res.product } : p)),
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
        // Refresh page 1 to sync with Salla pagination
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

  const totalPages = pagination?.totalPages || 1;
  const total = pagination?.total ?? products.length;

  const header = (
    <div className="panel-header">
      <div>
        <h2 className="panel-title">Products Management</h2>
        <span className="panel-subtitle">
          Full CRUD on Salla Admin API (/admin/v2/products)
        </span>
      </div>
      <div className="panel-actions">
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
    </div>
  );
}
