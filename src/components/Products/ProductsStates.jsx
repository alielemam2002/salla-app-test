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
      title="تعذّر تحميل المنتجات"
      description={
        <>
          <p className="products-error-message">
            تعذّر تحميل المنتجات: {error.message}
          </p>
          {hint && <p className="products-hint">{hint}</p>}
        </>
      }
      action={
        <>
          {error.code === "session_invalid" && (
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

/** No products at all, or none matching the filters. */
export function ProductsEmptyState({ hasFilters, onClearFilters }) {
  return (
    <EmptyState
      icon={hasFilters ? PackageSearch : PackageOpen}
      title={hasFilters ? "لا توجد نتائج مطابقة" : "لا توجد منتجات بعد"}
      description={
        <p>
          {hasFilters
            ? "لم نجد منتجات تطابق البحث أو الفلاتر الحالية. جرّب كلمات أخرى أو امسح الفلاتر."
            : "لا توجد منتجات في هذا المتجر بعد. ابدأ بإضافة أول منتج."}
        </p>
      }
      action={
        hasFilters && (
          <Button size="small" variant="secondary" onClick={onClearFilters}>
            مسح الفلاتر
          </Button>
        )
      }
    />
  );
}
