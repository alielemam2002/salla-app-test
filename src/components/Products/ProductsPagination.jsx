import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/index.js";

/** Previous / next pager. Hidden when there is a single page. */
export default function ProductsPagination({
  page,
  totalPages,
  disabled,
  onPageChange,
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="products-pagination" aria-label="التنقل بين الصفحات">
      <Button
        size="small"
        variant="secondary"
        icon={ChevronRight}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1 || disabled}
      >
        الصفحة السابقة
      </Button>
      <span className="products-pagination-label">
        الصفحة {page} من {totalPages}
      </span>
      <Button
        size="small"
        variant="secondary"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages || disabled}
      >
        الصفحة التالية
        <ChevronLeft size={14} aria-hidden="true" />
      </Button>
    </nav>
  );
}
