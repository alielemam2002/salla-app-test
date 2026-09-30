import { whatsappNumber } from "../cartRecovery/whatsappMessage.js";
import { createLocalStore } from "../localStore.js";

/**
 * WhatsApp campaigns (e.g. an offer or a promo code) to chosen customers.
 * Every message is an approved Meta *template*; its {{1}}, {{2}}… are filled
 * per customer from these sources.
 */
export const VARIABLE_SOURCES = [
  { value: "customer_name", label: "الاسم الأول للعميل" },
  { value: "coupon_code", label: "كود الكوبون" },
  { value: "custom", label: "نص مخصص (عرض، خصم، رابط…)" },
];

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

/** Form → the campaign sent with every message. */
export function formToCampaign(form) {
  return {
    name: form.name.trim(),
    template: form.template.trim(),
    language: form.language.trim(),
    params: form.params.map((p) => ({
      source: p.source,
      value: p.source === "customer_name" ? "" : String(p.value || "").trim(),
    })),
  };
}

/** "{{1}} = Ahmed" lines for the review step (sample customer). */
export function describeVariables(campaign, sampleName = "أحمد") {
  return campaign.params.map((p, i) => {
    const value =
      p.source === "customer_name" ? `${sampleName} (اسم كل عميل)` : p.value;
    return `{{${i + 1}}} = ${value}`;
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
