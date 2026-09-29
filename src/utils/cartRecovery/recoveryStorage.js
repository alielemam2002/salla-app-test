import { DEFAULT_ABANDONED_AFTER } from "./cartModel.js";
import { DEFAULT_TEMPLATES } from "./whatsappMessage.js";

/**
 * Per-browser storage for Stage 1 (there is no database):
 * - settings: "abandoned after" threshold, message language, templates,
 *   chosen coupon code
 * - contacts: when the merchant opened WhatsApp for a cart. We can't know
 *   whether they pressed send, so this is "WhatsApp opened", not "sent".
 */

function createLocalStore(key, fallback) {
  const listeners = new Set();
  let cache;

  const read = () => {
    if (cache !== undefined) return cache;
    try {
      const raw = window.localStorage.getItem(key);
      cache = raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch {
      cache = fallback;
    }
    return cache;
  };

  const write = (next) => {
    cache = next;
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage blocked or full: keep it for this session only.
    }
    listeners.forEach((listener) => listener());
  };

  return {
    get: read,
    set: (update) =>
      write(typeof update === "function" ? update(read()) : update),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset: () => {
      cache = undefined;
    },
  };
}

export const DEFAULT_SETTINGS = {
  abandonedAfter: DEFAULT_ABANDONED_AFTER,
  locale: "ar",
  templates: DEFAULT_TEMPLATES,
  couponCode: "",
};

export const settingsStore = createLocalStore(
  "salla_cart_recovery_settings_v1",
  DEFAULT_SETTINGS,
);

// { [cartId]: ISO time of the last time WhatsApp was opened for it }
export const contactsStore = createLocalStore(
  "salla_cart_recovery_contacts_v1",
  {},
);

export function recordContact(cartId) {
  contactsStore.set((prev) => ({
    ...prev,
    [cartId]: new Date().toISOString(),
  }));
}
