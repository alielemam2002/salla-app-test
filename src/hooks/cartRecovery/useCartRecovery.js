import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAbandonedCart,
  fetchAllAbandonedCarts,
} from "../../utils/cartsApi.js";
import {
  apiSendsStore,
  contactsStore,
  hiddenStore,
  hideCart,
  unhideCart,
  recentlySent,
  recordApiSend,
  recordContact,
  settingsStore,
} from "../../utils/cartRecovery/recoveryStorage.js";
import {
  deleteWhatsAppSettings,
  fetchWhatsAppSettings,
  fetchWhatsAppStatus,
  saveWhatsAppSettings,
  sendCartWhatsApp,
  sendWhatsAppTest,
  setWhatsAppEnabled,
} from "../../utils/whatsappApi.js";
import { whatsappNumber } from "../../utils/cartRecovery/whatsappMessage.js";

/** Error carrying the API result so the UI can describe it. */
export class CartsApiError extends Error {
  constructor(result) {
    super(result?.error || "تعذّر تنفيذ طلب السلات");
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
  error: "لم يتم العثور على رمز الجلسة. افتح التطبيق من لوحة تحكم سلة.",
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

/** Is the WhatsApp Cloud API configured on the server (and which template)? */
export function useWhatsAppStatus(getToken) {
  return useQuery({
    queryKey: whatsappKeys.status,
    queryFn: async () => {
      const token = getToken();
      if (!token) throw new CartsApiError(noToken);
      const result = await fetchWhatsAppStatus(token);
      if (!result.success) throw new CartsApiError(result);
      return result;
    },
    retry: false,
    staleTime: 10 * 60 * 1000,
  });
}

/** Carts hidden from the list in this browser, and how to hide/show them. */
export function useHiddenCarts() {
  const hidden = useSyncExternalStore(
    hiddenStore.subscribe,
    hiddenStore.get,
    hiddenStore.get,
  );
  return { hidden, hideCart, unhideCart };
}

/** Messages Meta accepted per cart (this browser). */
export function useApiSends() {
  return useSyncExternalStore(
    apiSendsStore.subscribe,
    apiSendsStore.get,
    apiSendsStore.get,
  );
}

const EMPTY_BATCH = null;

/**
 * Send cart reminders through api/whatsapp.js. `send` does one cart;
 * `sendMany` goes one cart at a time (never in parallel), skips carts
 * without an international number or messaged in the last 24 hours, and
 * can be stopped. Local UI state only: nothing is queued on a server.
 */
export function useWhatsAppSender(getToken) {
  const [sending, setSending] = useState(() => new Set());
  const [errors, setErrors] = useState({});
  const [batch, setBatch] = useState(EMPTY_BATCH);
  const stopRef = useRef(false);

  const mark = (cartId, on) =>
    setSending((prev) => {
      const next = new Set(prev);
      if (on) next.add(cartId);
      else next.delete(cartId);
      return next;
    });

  const send = useCallback(
    async (cartId, couponCode, options) => {
      const token = getToken();
      mark(cartId, true);
      const result = token
        ? await sendCartWhatsApp(token, cartId, couponCode, options)
        : noToken;
      mark(cartId, false);
      if (result.success) {
        recordApiSend(cartId, result.messageId);
        setErrors((prev) => {
          const next = { ...prev };
          delete next[cartId];
          return next;
        });
      } else {
        setErrors((prev) => ({ ...prev, [cartId]: result }));
      }
      return result;
    },
    [getToken],
  );

  const sendMany = useCallback(
    async (carts, couponCode, { mode, textFor } = {}) => {
      const sends = apiSendsStore.get();
      const targets = carts.filter(
        (cart) =>
          whatsappNumber(cart.customer?.mobile) &&
          !recentlySent(sends, cart.id),
      );
      stopRef.current = false;
      const tally = {
        running: true,
        total: targets.length,
        done: 0,
        sent: 0,
        failed: 0,
        skipped: carts.length - targets.length,
        stopped: false,
      };
      setBatch({ ...tally });
      for (const cart of targets) {
        if (stopRef.current) {
          tally.stopped = true;
          break;
        }
        const result = await send(
          cart.id,
          couponCode,
          mode === "text" ? { mode, text: textFor(cart) } : undefined,
        );
        tally.done += 1;
        if (result.success) tally.sent += 1;
        else tally.failed += 1;
        setBatch({ ...tally });
        // Salla's token or Meta's config is broken: every next send would fail.
        if (
          !result.success &&
          [
            "whatsapp_not_configured",
            "session_invalid",
            "token_expired",
          ].includes(result.code)
        ) {
          tally.stopped = true;
          break;
        }
      }
      const final = { ...tally, running: false };
      setBatch(final);
      return final;
    },
    [send],
  );

  const stop = useCallback(() => {
    stopRef.current = true;
  }, []);
  const clearBatch = useCallback(() => setBatch(EMPTY_BATCH), []);

  return { send, sendMany, stop, clearBatch, sending, errors, batch };
}

export const whatsappKeys = {
  status: ["whatsapp-status"],
  settings: ["whatsapp-settings"],
};

/** The merchant's WhatsApp settings (token masked) and storage readiness. */
export function useWhatsAppSettings(getToken, { enabled = true } = {}) {
  return useQuery({
    queryKey: whatsappKeys.settings,
    queryFn: async () => {
      const token = getToken();
      if (!token) throw new CartsApiError(noToken);
      const result = await fetchWhatsAppSettings(token);
      if (!result.success) throw new CartsApiError(result);
      return { storageReady: result.storageReady, settings: result.settings };
    },
    enabled,
    retry: false,
  });
}

/** Save / delete / switch settings and send a test; changes refresh the status. */
export function useWhatsAppSettingsMutations(getToken) {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: whatsappKeys.status });
    queryClient.invalidateQueries({ queryKey: whatsappKeys.settings });
  };
  const withToken = (fn) => async (vars) => {
    const token = getToken();
    if (!token) throw new CartsApiError(noToken);
    const result = await fn(token, vars);
    if (!result.success) throw new CartsApiError(result);
    return result;
  };

  const save = useMutation({
    mutationFn: withToken((token, settings) =>
      saveWhatsAppSettings(token, settings),
    ),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: withToken((token) => deleteWhatsAppSettings(token)),
    onSuccess: refresh,
  });
  const sendTest = useMutation({
    mutationFn: withToken((token, to) => sendWhatsAppTest(token, to)),
  });
  const toggle = useMutation({
    mutationFn: withToken((token, enabled) =>
      setWhatsAppEnabled(token, enabled),
    ),
    onSuccess: refresh,
  });
  return { save, remove, sendTest, toggle };
}
