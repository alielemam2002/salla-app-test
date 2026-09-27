import { useState, useEffect, useCallback, useRef } from "react";
import Button from "../forms/Button.jsx";
import {
  fetchProductsPage,
  fetchAllProducts,
} from "../../utils/productsApi.js";
import logger from "../../utils/logger.js";

const PER_PAGE = 30;

// Setup hints shown for errors the merchant/developer can fix
const ERROR_HINTS = {
  not_installed:
    "No access token is stored for this store yet. Reinstall the app on the store so Salla sends app.store.authorize to /api/webhook.",
  storage_not_configured:
    "Add Upstash Redis to the Vercel project (Storage → Marketplace), then redeploy.",
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
    product.image?.url ||
    null
  );
}

function ProductRow({ product, expanded, onToggle }) {
  const image = productImage(product);
  const stock = product.unlimited_quantity ? "∞" : (product.quantity ?? "—");

  return (
    <>
      <tr className="products-row" onClick={() => onToggle(product.id)}>
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
          </div>
        </td>
        <td>
          {formatPrice(product.price)}
          {product.sale_price?.amount ? (
            <div className="products-meta">
              Sale: {formatPrice(product.sale_price)}
            </div>
          ) : null}
        </td>
        <td>{stock}</td>
        <td>
          <span
            className={`products-status products-status--${product.status}`}
          >
            {product.status || "—"}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="products-details">
          <td colSpan={5}>
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
  const requestIdRef = useRef(0);

  const getToken = useCallback(
    () => embedded?.auth?.getToken?.() || null,
    [embedded],
  );

  const handleFailure = useCallback((result) => {
    logger.error("Products fetch failed:", result);
    setError({ code: result.code, message: result.error });
  }, []);

  const loadPage = useCallback(
    async (targetPage) => {
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
    [getToken, handleFailure],
  );

  const loadAll = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    setProgress({ page: 0, totalPages: pagination?.totalPages || "?" });

    const result = await fetchAllProducts(token, {
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
  }, [getToken, pagination, showToast, handleFailure]);

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  const toggleExpanded = useCallback((id) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  const totalPages = pagination?.totalPages || 1;
  const total = pagination?.total ?? products.length;

  const header = (
    <div className="panel-header">
      <div>
        <h2 className="panel-title">Products</h2>
        <span className="panel-subtitle">
          GET /admin/v2/products via /api/products (embedded token → introspect
          → stored merchant access token)
        </span>
      </div>
      <div className="panel-actions">
        <Button
          onClick={() => loadPage(showingAll ? 1 : page)}
          disabled={isLoading}
        >
          Refresh
        </Button>
        <Button
          variant="primary"
          onClick={loadAll}
          disabled={isLoading || !!error}
        >
          Fetch all
        </Button>
      </div>
    </div>
  );

  let content;
  if (isLoading) {
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
    content = <div className="products-state">This store has no products.</div>;
  } else {
    content = (
      <>
        <div className="products-summary">
          {showingAll
            ? `Showing all ${products.length} products`
            : `Showing ${products.length} of ${total} products · page ${page} of ${totalPages}`}
        </div>
        <div className="products-table-wrapper">
          <table className="products-table">
            <thead>
              <tr>
                <th />
                <th>Product</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  expanded={expandedId === product.id}
                  onToggle={toggleExpanded}
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
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span>
              Page {page} / {totalPages}
            </span>
            <Button
              size="small"
              onClick={() => loadPage(page + 1)}
              disabled={page >= totalPages}
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
        {content}
      </div>
    </div>
  );
}
