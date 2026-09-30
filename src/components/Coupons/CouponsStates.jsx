import { AlertTriangle, Plus, SearchX, Ticket } from "lucide-react";
import { Button, EmptyState, Skeleton } from "../ui/index.js";

/** Skeleton cards while the first load is in flight. */
export function CouponsSkeleton({ count = 6 }) {
  return (
    <div className="coupon-grid coupon-grid--loading" aria-busy="true">
      <span className="sr-only" role="status">
        جارٍ تحميل الكوبونات…
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
        title="لا توجد كوبونات مطابقة"
        description={<p>جرّب كودًا آخر أو غيّر فلتر الحالة.</p>}
        action={
          <Button size="small" variant="secondary" onClick={onClearFilters}>
            إعادة ضبط الفلاتر
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={Ticket}
      title="لا توجد كوبونات بعد"
      description={
        <p>أنشئ أول كوبون خصم يعمل على المتجر بالكامل وشاركه مع عملائك.</p>
      }
      action={
        <Button variant="primary" icon={Plus} onClick={onCreate}>
          إنشاء كوبون
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
              تحديث الجلسة
            </Button>
          )}
          <Button variant="secondary" onClick={onRetry}>
            إعادة المحاولة
          </Button>
        </>
      }
    />
  );
}
