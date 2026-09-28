import { AlertTriangle, PackageSearch, PackageOpen } from "lucide-react";
import { Button, EmptyState } from "../ui/index.js";
import { PRODUCT_ERROR_HINTS } from "../../utils/productConstants.js";

/** Load failure with a setup hint and retry / refresh-session actions. */
export function ProductsErrorState({ error, onRetry, onRefreshSession }) {
  const hint = PRODUCT_ERROR_HINTS[error.code];
  return (
    <EmptyState
      tone="danger"
      icon={AlertTriangle}
      title="Couldn't load products"
      description={
        <>
          <p className="products-error-message">
            Failed to load products: {error.message}
          </p>
          {hint && <p className="products-hint">{hint}</p>}
        </>
      }
      action={
        <>
          {error.code === "session_invalid" && (
            <Button variant="primary" onClick={onRefreshSession}>
              Refresh session
            </Button>
          )}
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </>
      }
    />
  );
}

/** No products at all, or none matching the filters. */
export function ProductsEmptyState({ hasFilters, onClearFilters }) {
  return (
    <EmptyState
      icon={hasFilters ? PackageSearch : PackageOpen}
      title={hasFilters ? "No matches" : "No products yet"}
      description={
        <p>
          {hasFilters
            ? "No products found matching your search filter."
            : "This store has no products."}
        </p>
      }
      action={
        hasFilters && (
          <Button size="small" variant="secondary" onClick={onClearFilters}>
            Clear Filters
          </Button>
        )
      }
    />
  );
}
