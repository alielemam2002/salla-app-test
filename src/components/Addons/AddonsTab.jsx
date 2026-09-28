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
        <strong>{count}</strong> addon{count > 1 ? "s" : ""} selected
      </span>
      <div className="addons-selection-actions">
        <Button size="small" variant="ghost" icon={X} onClick={onClear}>
          Clear
        </Button>
        <Button
          size="small"
          variant="primary"
          icon={ShoppingCart}
          onClick={onBuy}
        >
          Buy selected
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
        title="Failed to load addons"
        description={error}
        action={
          <Button variant="primary" icon={RefreshCw} onClick={reload}>
            Retry
          </Button>
        }
      />
    );
  } else if (addons.length === 0) {
    content = (
      <EmptyState
        icon={PackageOpen}
        title="No addons yet"
        description="Define addons in the Partners Portal publish form (Pricing step), then refresh."
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
          title="Addon Store"
          subtitle="Test checkout flow with embedded.checkout.getAddons() and embedded.checkout.create()"
          actions={
            <Button
              size="small"
              icon={RefreshCw}
              onClick={reload}
              disabled={isLoading}
            >
              Refresh
            </Button>
          }
        />
        <Card.Body className="addons-body">{content}</Card.Body>
      </Card>
    </div>
  );
}
