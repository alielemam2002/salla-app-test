import { TEMPLATE_VARIABLES } from "../cartRecovery/whatsappMessage.js";
import { REPLENISH_VARIABLES } from "../replenish/replenishModel.js";

/**
 * A feature's WhatsApp template (stage 2 of Settings): one template from the
 * merchant's library (read from Meta, api/whatsapp.js templates_sync) and
 * what fills each of its variables. Shared by the picker and the server,
 * which re-checks every binding against the library before saving/sending.
 *
 * binding = {
 *   templateId, name, language, parameterFormat, category,
 *   slots: [{ part: "header" | "body" | "button", name, index?, url?,
 *             source, value? }]
 * }
 * `source` is one of the feature's values, or "custom" with a fixed `value`.
 */

export const CUSTOM_SOURCE = "custom";

// What each feature can put into a variable.
export const BINDING_SOURCES = {
  cart: TEMPLATE_VARIABLES,
  replenish: REPLENISH_VARIABLES,
  campaign: [
    { key: "customer_name", label: "الاسم الأول للعميل" },
    { key: "coupon_code", label: "كود كوبون الحملة" },
  ],
};

export const BINDING_FEATURES = Object.keys(BINDING_SOURCES);

/** The variables a template needs, in the order they are sent. */
export function templateSlots(template) {
  const variables = template?.variables || {};
  return [
    ...(variables.header || []).map((name) => ({ part: "header", name })),
    ...(variables.body || []).map((name) => ({ part: "body", name })),
    ...(variables.buttons || []).map((button) => ({
      part: "button",
      name: "1",
      index: button.index,
      url: button.url,
      text: button.text,
    })),
  ];
}

export const slotKey = (slot) =>
  `${slot.part}:${slot.name}:${slot.index ?? ""}`;

/** "{{1}} في النص", "{{name}} في العنوان", "رابط زر «أكمل الطلب»". */
export function slotLabel(slot) {
  if (slot.part === "button") {
    return slot.text ? `رابط زر «${slot.text}»` : "رابط الزر";
  }
  return `{{${slot.name}}} في ${slot.part === "header" ? "العنوان" : "النص"}`;
}

/**
 * A good first guess for each variable, so picking a template is usually
 * enough: link buttons get the feature's link, text variables its values in
 * order.
 */
export function defaultSlots(template, sources) {
  const urlSource = sources.find((s) => s.key.endsWith("_url"));
  const textSources = sources.filter((s) => !s.key.endsWith("_url"));
  let next = 0;
  return templateSlots(template).map((slot) => {
    if (slot.part === "button") {
      return { ...slot, source: urlSource?.key || CUSTOM_SOURCE, value: "" };
    }
    const source = textSources[next] || urlSource;
    next += 1;
    return { ...slot, source: source?.key || CUSTOM_SOURCE, value: "" };
  });
}

/**
 * The binding from the browser + the library → a checked binding (template
 * details taken from the library, never from the browser), or { error }.
 */
export function resolveBinding(input, templates, sources) {
  const template = (templates || []).find(
    (t) => t.id === String(input?.templateId || ""),
  );
  if (!template) {
    return {
      error: "اختر قالبًا من قوالبك (حدّثها من الإعدادات إن لم يظهر).",
    };
  }
  if (template.status !== "APPROVED") {
    return { error: `القالب «${template.name}» غير معتمد من Meta بعد.` };
  }
  const allowed = new Set(sources.map((s) => s.key));
  const given = new Map(
    (Array.isArray(input.slots) ? input.slots : []).map((s) => [slotKey(s), s]),
  );
  const slots = [];
  for (const slot of templateSlots(template)) {
    const chosen = given.get(slotKey(slot));
    if (chosen?.source === CUSTOM_SOURCE) {
      const value = String(chosen.value || "").trim();
      if (!value) return { error: `اكتب النص الثابت لـ ${slotLabel(slot)}.` };
      slots.push({
        ...slot,
        source: CUSTOM_SOURCE,
        value: value.slice(0, 1000),
      });
    } else if (allowed.has(chosen?.source)) {
      slots.push({ ...slot, source: chosen.source });
    } else {
      return { error: `اختر ما يملأ ${slotLabel(slot)}.` };
    }
  }
  return {
    binding: {
      templateId: template.id,
      name: template.name,
      language: template.language,
      parameterFormat: template.parameterFormat || "POSITIONAL",
      category: template.category,
      slots,
    },
  };
}

/**
 * A link button's variable is appended to the fixed part of its URL in
 * Meta ("https://salla.sa/{{1}}"): send only what follows that part.
 */
export function urlButtonValue(templateUrl, value) {
  const base = String(templateUrl || "").split("{{")[0];
  const text = String(value || "").trim();
  return base && text.startsWith(base) ? text.slice(base.length) : text;
}

/** The template's text with each variable shown as what fills it. */
export function previewText(template, slots, sources) {
  const labels = new Map(sources.map((s) => [s.key, s.label]));
  const fill = (text, part) =>
    String(text || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, name) => {
      const slot = slots.find((s) => s.part === part && s.name === name);
      if (!slot) return whole;
      if (slot.source === CUSTOM_SOURCE) return slot.value || "…";
      return `[${labels.get(slot.source) || slot.source}]`;
    });
  return {
    header: template.header?.text ? fill(template.header.text, "header") : null,
    body: fill(template.body, "body"),
  };
}
