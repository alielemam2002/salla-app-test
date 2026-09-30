import {
  AlertCircle,
  PackageOpen,
  RefreshCw,
  ShoppingCart,
  Store,
  X,
} from "lucide-react";
import { Button, Card, EmptyState } from "../ui/index.js";
import AddonsGrid, { AddonsGridSkeleton } from "./AddonsGrid.jsx";
import { useAddons } from "../../hooks/addons/useAddons.js";

function SelectionBar({ count, onBuy, onClear }) {
  if (count === 0) return null;
  return (
    <div className="addons-selection" role="status">
      <span>
        تم تحديد <strong>{count}</strong>{" "}
        {count > 2 && count < 11 ? "إضافات" : "إضافة"}
      </span>
      <div className="addons-selection-actions">
        <Button size="small" variant="ghost" icon={X} onClick={onClear}>
          إلغاء التحديد
        </Button>
        <Button
          size="small"
          variant="primary"
          icon={ShoppingCart}
          onClick={onBuy}
        >
          شراء المحدد
        </Button>
      </div>
    </div>
  );
}

/** Addon store: embedded.checkout.getAddons() + embedded.checkout.create(). */
export default function AddonsTab({ embedded, logMessage, showToast }) {
  const {
    addons,
    isLoading,
    error,
    reload,
    setQuantity,
    getCheckoutState,
    selected,
    toggleSelect,
    clearSelection,
    buy,
    buySelected,
  } = useAddons({ embedded, logMessage, showToast });

  let content;
  if (isLoading) {
    content = <AddonsGridSkeleton />;
  } else if (error) {
    content = (
      <EmptyState
        icon={AlertCircle}
        tone="danger"
        title="تعذّر تحميل الإضافات"
        description={error}
        action={
          <Button variant="primary" icon={RefreshCw} onClick={reload}>
            إعادة المحاولة
          </Button>
        }
      />
    );
  } else if (addons.length === 0) {
    content = (
      <EmptyState
        icon={PackageOpen}
        title="لا توجد إضافات بعد"
        description="لم يتم إعداد أي إضافة لهذا التطبيق حتى الآن. أضفها من مرحلة التسعير في بوابة الشركاء ثم اضغط تحديث."
      />
    );
  } else {
    content = (
      <>
        <SelectionBar
          count={selected.size}
          onBuy={buySelected}
          onClear={clearSelection}
        />
        <AddonsGrid
          addons={addons}
          selected={selected}
          getCheckoutState={getCheckoutState}
          onBuy={buy}
          onToggleSelect={toggleSelect}
          onQuantityChange={setQuantity}
        />
      </>
    );
  }

  return (
    <div className="addons-container">
      <Card>
        <Card.Header
          icon={Store}
          title="متجر الإضافات"
          subtitle="تصفّح إضافات التطبيق واشترِها وأتمم الدفع بأمان عبر سلة"
          actions={
            <Button
              size="small"
              icon={RefreshCw}
              onClick={reload}
              disabled={isLoading}
            >
              تحديث
            </Button>
          }
        />
        <Card.Body className="addons-body">{content}</Card.Body>
      </Card>
    </div>
  );
}
