import { useCallback, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAbandonedCart,
  fetchAllAbandonedCarts,
} from "../../utils/cartsApi.js";
import {
  contactsStore,
  recordContact,
  settingsStore,
} from "../../utils/cartRecovery/recoveryStorage.js";

/** Error carrying the API result so the UI can describe it. */
export class CartsApiError extends Error {
  constructor(result) {
    super(result?.error || "Carts request failed");
    this.name = "CartsApiError";
    this.result = result;
  }
}

export const cartKeys = {
  all: ["abandoned-carts"],
  list: () => ["abandoned-carts", "list"],
  detail: (id) => ["abandoned-carts", "detail", String(id)],
};

const noToken = {
  success: false,
  status: 401,
  code: "session_invalid",
  error: "No embedded token found",
};

// Auth / scope / validation errors won't fix themselves; retry others once.
const retryOnce = (count, error) =>
  count < 1 && !(error?.result?.status >= 400 && error.result.status < 500);

/**
 * Every abandoned cart Salla lists (up to the page cap). Loaded on demand
 * and on "Refresh": no background polling.
 */
export function useAbandonedCarts(getToken) {
  return useQuery({
    queryKey: cartKeys.list(),
    queryFn: async () => {
      const token = getToken();
      if (!token) throw new CartsApiError(noToken);
      const result = await fetchAllAbandonedCarts(token);
      if (!result.success) throw new CartsApiError(result);
      return { carts: result.carts, truncated: result.truncated };
    },
    retry: retryOnce,
    staleTime: 5 * 60 * 1000,
  });
}

/** One cart's full details (items, status) plus product names. */
export function useAbandonedCart(getToken, cartId) {
  return useQuery({
    queryKey: cartKeys.detail(cartId),
    queryFn: async () => {
      const token = getToken();
      if (!token) throw new CartsApiError(noToken);
      const result = await fetchAbandonedCart(token, cartId);
      if (!result.success) throw new CartsApiError(result);
      return { cart: result.cart, products: result.products || {} };
    },
    enabled: Boolean(cartId),
    retry: retryOnce,
  });
}

/** Per-browser recovery settings (threshold, templates, coupon). */
export function useRecoverySettings() {
  const settings = useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.get,
    settingsStore.get,
  );
  const update = useCallback(
    (patch) => settingsStore.set((prev) => ({ ...prev, ...patch })),
    [],
  );
  return [settings, update];
}

/** When WhatsApp was last opened per cart, and a way to record it. */
export function useCartContacts() {
  const contacts = useSyncExternalStore(
    contactsStore.subscribe,
    contactsStore.get,
    contactsStore.get,
  );
  return { contacts, recordContact };
}
