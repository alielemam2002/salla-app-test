import { useCallback, useEffect, useRef, useState } from "react";

const BUY_SELECTED_ACTION = "buy-selected";

/**
 * Multi-select for addons, mirrored into the host navbar as a
 * "Buy Selected (n)" primary action.
 */
export function useAddonSelection({ embedded, onBuySelected }) {
  const [selected, setSelected] = useState(() => new Set());
  // Keep a ref so the onActionClick handler always sees the latest callback
  const buySelectedRef = useRef(onBuySelected);
  buySelectedRef.current = onBuySelected;

  const toggle = useCallback((slug) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  // Show/hide the navbar action based on the selection
  useEffect(() => {
    if (!embedded?.nav) return;
    if (selected.size > 0) {
      embedded.nav.setAction({
        title: `شراء المحدد (${selected.size})`,
        value: BUY_SELECTED_ACTION,
        icon: "hgi hgi-stroke hgi-shopping-cart-01",
      });
    } else {
      embedded.nav.clearAction();
    }
  }, [selected.size, embedded]);

  // Subscribe to navbar action clicks and clean up on unmount
  useEffect(() => {
    if (!embedded?.nav?.onActionClick) return undefined;
    const unsubscribe = embedded.nav.onActionClick((value) => {
      if (value === BUY_SELECTED_ACTION) buySelectedRef.current?.();
    });
    return () => {
      unsubscribe();
      embedded.nav.clearAction();
    };
  }, [embedded]);

  return { selected, toggle, clear };
}
