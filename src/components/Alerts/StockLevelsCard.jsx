import { PackageCheck, PackageSearch, RefreshCw } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Select,
  Skeleton,
} from "../ui/index.js";
import {
  THRESHOLD_OPTIONS,
  stockLabel,
} from "../../utils/alerts/stockModel.js";
import { PRODUCT_ERROR_HINTS } from "../../utils/productConstants.js";

function StockTable({ products }) {
  return (
    <div className="cart-table-wrap">
      <table className="cart-table">
        <thead>
          <tr>
            <th>المنتج</th>
            <th>SKU</th>
            <th>الكمية</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>{product.name || `منتج ${product.id}`}</td>
              <td dir="ltr">{product.sku || "—"}</td>
              <td className="cart-num">{product.quantity ?? "—"}</td>
              <td>
                <Badge tone={product.kind === "out" ? "danger" : "warning"} dot>
                  {stockLabel(product.kind, product.quantity)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Products that are out of stock or at/under the threshold right now, read
 * from Salla's product list. The threshold is also used for order alerts.
 */
export default function StockLevelsCard({
  query,
  threshold,
  canSaveThreshold,
  onThresholdChange,
  savingThreshold,
}) {
  let content;
  if (query.isPending) {
    content = (
      <div className="cart-loading" aria-busy="true">
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} height={40} />
        ))}
      </div>
    );
  } else if (query.isError) {
    const result = query.error.result || {};
    content = (
      <Alert
        tone="error"
        title="تعذّر قراءة المخزون"
        action={
          <Button size="small" onClick={() => query.refetch()}>
            إعادة المحاولة
          </Button>
        }
      >
        {PRODUCT_ERROR_HINTS[result.code] || result.error}
      </Alert>
    );
  } else {
    const { out, low, scanned, truncated } = query.data;
    const products = [...out, ...low];
    content = (
      <>
        <p className="alerts-summary">
          <Badge tone="danger" dot>
            نفد: {out.length}
          </Badge>
          <Badge tone="warning" dot>
            قارب على النفاد: {low.length}
          </Badge>
          <span className="form-hint">من {scanned} منتج</span>
        </p>
        {products.length ? (
          <StockTable products={products} />
        ) : (
          <EmptyState
            icon={PackageCheck}
            title="كل المنتجات متوفرة"
            description="لا يوجد منتج نفد أو وصلت كميته إلى الحد الذي اخترته."
          />
        )}
        {truncated && (
          <Alert tone="warning">
            تمت مراجعة أول {scanned} منتج فقط من متجرك.
          </Alert>
        )}
      </>
    );
  }

  return (
    <Card className="alerts-card">
      <Card.Header
        icon={PackageSearch}
        title="المخزون الآن"
        subtitle="المنتجات التي نفدت أو قاربت على النفاد في متجرك."
        actions={
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={() => query.refetch()}
            loading={query.isFetching && !query.isPending}
            disabled={query.isPending}
          >
            تحديث
          </Button>
        }
      />
      <div className="alerts-body">
        <label className="cart-threshold">
          <span>نبّهني عندما تصل الكمية إلى</span>
          <Select
            aria-label="نبّهني عندما تصل الكمية إلى"
            value={String(threshold)}
            disabled={!canSaveThreshold || savingThreshold}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
            options={THRESHOLD_OPTIONS.map((o) => ({
              value: String(o.value),
              label: o.label,
            }))}
          />
        </label>
        {content}
      </div>
    </Card>
  );
}
