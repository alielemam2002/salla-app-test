import { DEFAULT_ABANDONED_AFTER } from "./cartModel.js";
import { DEFAULT_TEMPLATES } from "./whatsappMessage.js";
import { createLocalStore } from "../localStore.js";

/**
 * Per-browser storage for Stage 1 (there is no database):
 * - settings: "abandoned after" threshold, message language, templates,
 *   chosen coupon code
 * - contacts: when the merchant opened WhatsApp for a cart. We can't know
 *   whether they pressed send, so this is "WhatsApp opened", not "sent".
 */

export const DEFAULT_SETTINGS = {
  abandonedAfter: DEFAULT_ABANDONED_AFTER,
  locale: "ar",
  templates: DEFAULT_TEMPLATES,
  couponCode: "",
  // What the in-app "Send" buttons send: "template" (approved template) or
  // "text" (the message below as a normal message, 24-hour window only).
  sendMode: "template",
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

// { [cartId]: { at, messageId } } for messages Meta accepted through the
// Cloud API. "Accepted" isn't "delivered": delivery comes from Meta's
// webhook, which needs stage 2.
export const apiSendsStore = createLocalStore(
  "salla_cart_recovery_api_sends_v1",
  {},
);

export function recordApiSend(cartId, messageId) {
  apiSendsStore.set((prev) => ({
    ...prev,
    [cartId]: { at: new Date().toISOString(), messageId },
  }));
}

// Don't send another API reminder to the same cart within this window.
export const API_RESEND_GAP_MS = 24 * 60 * 60 * 1000;

export function recentlySent(sends, cartId, now = Date.now()) {
  const at = Date.parse(sends[cartId]?.at || "");
  return Number.isFinite(at) && now - at < API_RESEND_GAP_MS;
}

// { [cartId]: ISO time } — carts hidden from the list in this browser.
// Salla has no API to delete an abandoned cart; hiding only affects this app.
export const hiddenStore = createLocalStore(
  "salla_cart_recovery_hidden_v1",
  {},
);

export function hideCart(cartId) {
  hiddenStore.set((prev) => ({ ...prev, [cartId]: new Date().toISOString() }));
}

export function unhideCart(cartId) {
  hiddenStore.set((prev) => {
    const next = { ...prev };
    delete next[cartId];
    return next;
  });
}

export function recordContact(cartId) {
  contactsStore.set((prev) => ({
    ...prev,
    [cartId]: new Date().toISOString(),
  }));
}
