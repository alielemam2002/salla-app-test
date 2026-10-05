import { whatsappNumber } from "../cartRecovery/whatsappMessage.js";
import { createLocalStore } from "../localStore.js";
import { slotLabel } from "../whatsapp/templateBinding.js";

/**
 * WhatsApp campaigns (e.g. an offer or a promo code) to chosen customers.
 * Every message is an approved Meta *template* picked from the merchant's
 * library (Settings); its variables are filled per customer from
 * BINDING_SOURCES.campaign (customer name, the campaign coupon) or fixed text.
 */

/** Why a customer can't get a campaign message, or null if they can. */
export function ineligibleReason(customer) {
  if (customer.isBlocked) return "محظور في سلة";
  if (customer.notificationsEnabled === false) return "الإشعارات متوقفة في سلة";
  if (!whatsappNumber(customer.mobile)) return "لا يوجد رقم جوال دولي";
  return null;
}

/** Search (name, mobile, city) + customer group filter. */
export function filterCustomers(customers, { search = "", groupId = "" } = {}) {
  const q = search.trim().toLowerCase();
  return customers.filter((c) => {
    if (groupId && !c.groups.map(String).includes(String(groupId))) {
      return false;
    }
    if (!q) return true;
    return [c.name, c.mobile, c.city]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });
}

/** Does the template show the campaign coupon somewhere? */
export const usesCoupon = (slots) =>
  slots.some((slot) => slot.source === "coupon_code");

/** Form + the checked binding → the campaign sent with every message. */
export function formToCampaign(form, binding) {
  return {
    name: form.name.trim(),
    binding,
    couponCode: usesCoupon(binding.slots) ? form.couponCode || "" : "",
  };
}

/** "{{1}} في النص = أحمد (اسم كل عميل)" lines for the review step. */
export function describeVariables(campaign, sampleName = "أحمد") {
  return campaign.binding.slots.map((slot) => {
    const value =
      slot.source === "customer_name"
        ? `${sampleName} (اسم كل عميل)`
        : slot.source === "coupon_code"
          ? campaign.couponCode
          : slot.value;
    return `${slotLabel(slot)} = ${value}`;
  });
}

// Meta errors that will hit every next message too: stop the campaign.
const FATAL_META_CODES = new Set([
  0, 10, 190, 200, 131031, 131042, 132000, 132001, 132012, 133010,
]);
const FATAL_CODES = new Set([
  "whatsapp_not_configured",
  "whatsapp_disabled",
  "session_invalid",
  "validation_failed",
  "token_expired",
]);

export function isFatalSendError(result) {
  return (
    FATAL_CODES.has(result?.code) ||
    (result?.code === "meta_error" && FATAL_META_CODES.has(result.metaCode))
  );
}

// Past campaigns in this browser: { items: [{ id, name, template, at, total, sent, failed, stopped }] }
export const campaignLogStore = createLocalStore(
  "salla_whatsapp_campaigns_v1",
  { items: [] },
);

export function recordCampaign(entry) {
  campaignLogStore.set((prev) => ({
    items: [entry, ...(prev.items || [])].slice(0, 20),
  }));
}
