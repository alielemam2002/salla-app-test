import { Skeleton } from "../ui/index.js";

/** Placeholder rows while the first page loads. */
export default function ProductsTableSkeleton({ rows = 6, progress }) {
  return (
    <div className="products-skeleton" aria-busy="true">
      <p className="products-skeleton-label" role="status">
        {progress
          ? `Loading page ${progress.page} of ${progress.totalPages}… (${progress.loaded ?? 0} products)`
          : "Loading products..."}
      </p>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="products-skeleton-row">
          <Skeleton width={16} height={16} radius={4} />
          <Skeleton width={44} height={44} radius={8} />
          <div className="products-skeleton-text">
            <Skeleton width="45%" height={14} />
            <Skeleton width="25%" height={11} />
          </div>
          <Skeleton width={72} height={14} />
          <Skeleton width={56} height={20} radius={999} />
        </div>
      ))}
    </div>
  );
}
