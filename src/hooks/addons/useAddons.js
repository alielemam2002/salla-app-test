import { useCallback, useRef } from "react";
import { useCheckoutFlow } from "../useCheckoutFlow.js";
import { useAddonsCatalog } from "./useAddonsCatalog.js";
import { useAddonSelection } from "./useAddonSelection.js";

const toCheckoutItem = (addon) => ({
  type: "addon",
  slug: addon.slug,
  quantity: addon._quantity || 1,
});

/**
 * Everything the Addons tab needs: the catalog, per-addon checkout state,
 * multi-select, and buy actions (single or selected).
 */
export function useAddons({ embedded, logMessage, showToast }) {
  const { addons, isLoading, error, reload, setQuantity } = useAddonsCatalog({
    embedded,
    logMessage,
  });
  const { initiateCheckout, getCheckoutState } = useCheckoutFlow(
    embedded,
    showToast,
  );

  // The selection hook needs buySelected, and buySelected needs the selection.
  const selectionRef = useRef(null);

  const buySelected = useCallback(() => {
    const { selected, clear } = selectionRef.current;
    const items = addons.filter((a) => selected.has(a.slug));
    if (!items.length) return;
    logMessage("outgoing", {
      event: "embedded::checkout.create",
      items: items.map(toCheckoutItem),
    });
    initiateCheckout(items);
    clear();
  }, [addons, logMessage, initiateCheckout]);

  const selection = useAddonSelection({ embedded, onBuySelected: buySelected });
  selectionRef.current = selection;

  const buy = useCallback(
    (addon) => {
      logMessage("outgoing", {
        event: "embedded::checkout.create",
        items: [toCheckoutItem(addon)],
      });
      initiateCheckout(addon);
    },
    [logMessage, initiateCheckout],
  );

  return {
    addons,
    isLoading,
    error,
    reload,
    setQuantity,
    getCheckoutState,
    selected: selection.selected,
    toggleSelect: selection.toggle,
    clearSelection: selection.clear,
    buy,
    buySelected,
  };
}
