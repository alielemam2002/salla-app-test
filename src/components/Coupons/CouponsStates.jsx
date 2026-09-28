import { AlertTriangle, Plus, SearchX, Ticket } from "lucide-react";
import { Button, EmptyState, Skeleton } from "../ui/index.js";

/** Skeleton cards while the first load is in flight. */
export function CouponsSkeleton({ count = 6 }) {
  return (
    <div className="coupon-grid coupon-grid--loading" aria-busy="true">
      <span className="sr-only" role="status">
        Loading coupons…
      </span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="coupon-card coupon-card--skeleton">
          <div className="coupon-card-head">
            <Skeleton width="45%" height={18} />
            <Skeleton width={64} height={20} radius={999} />
          </div>
          <Skeleton width="35%" height={28} />
          <Skeleton width="55%" />
          <Skeleton width="70%" height={36} />
          <div className="coupon-card-actions">
            <Skeleton width={64} height={30} />
            <Skeleton width={64} height={30} />
            <Skeleton width={72} height={30} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CouponsEmptyState({ filtered, onCreate, onClearFilters }) {
  if (filtered) {
    return (
      <EmptyState
        icon={SearchX}
        title="No matching coupons"
        description={<p>Try another code or status filter.</p>}
        action={
          <Button size="small" variant="secondary" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={Ticket}
      title="No coupons yet"
      description={<p>Create your first storewide coupon.</p>}
      action={
        <Button variant="primary" icon={Plus} onClick={onCreate}>
          Create Coupon
        </Button>
      }
    />
  );
}

export function CouponsErrorState({ error, onRetry, onRefreshSession }) {
  return (
    <EmptyState
      tone="danger"
      icon={AlertTriangle}
      title={error.title}
      description={<p>{error.reason}</p>}
      action={
        <>
          {error.canRefreshSession && (
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
