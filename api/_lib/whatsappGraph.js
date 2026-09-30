/**
 * WhatsApp Cloud API (Meta Graph API) helpers.
 * - send:    POST /{version}/{phone-number-id}/messages (template messages)
 *            https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 * - profile: GET  /{version}/{phone-number-id}?fields=display_phone_number,verified_name,quality_rating
 *            https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers
 */

import { TEMPLATE_VARIABLES } from "../../src/utils/cartRecovery/whatsappMessage.js";

export const DEFAULT_GRAPH_VERSION = "v23.0";
export const ALLOWED_PARAMS = new Set(TEMPLATE_VARIABLES.map((v) => v.key));

// Meta error code → short, actionable reason (codes from Meta's error table).
const META_REASONS = {
  0: "تعذّر على Meta التحقق من رمز الوصول. أنشئ رمزًا جديدًا.",
  190: "انتهت صلاحية رمز وصول واتساب. أنشئ رمزًا جديدًا واحفظه في إعدادات واتساب.",
  10: "الرمز لا يملك صلاحية إرسال رسائل واتساب.",
  200: "لم يُرسل رمز وصول واتساب.",
  100: "رفضت Meta أحد بيانات الطلب (تحقق من معرّف رقم الهاتف).",
  130429: "تم الوصول إلى حد الإرسال في Meta. انتظر قليلًا ثم حاول مرة أخرى.",
  131026: "رقم العميل غير مسجّل في واتساب أو لا يستقبل الرسائل.",
  131030:
    "رقم الاختبار من Meta يرسل فقط إلى المستلمين الذين أضفتهم في إعداد واجهة البرمجة.",
  131031: "حساب واتساب للأعمال مقيّد.",
  131042: "هناك مشكلة في الدفع على حساب واتساب للأعمال.",
  131047:
    "العميل لم يراسلك خلال آخر 24 ساعة، لذلك لا يسمح واتساب بالرسالة النصية. استخدم القالب المعتمد أو الإرسال اليدوي.",
  131049:
    "أوقفت Meta هذه الرسالة التسويقية للحد من عدد الرسائل لكل عميل. حاول بعد 24 ساعة.",
  131056: "عدد الرسائل إلى هذا العميل كبير في وقت قصير.",
  132000:
    "عدد متغيرات القالب لا يطابق القالب. راجع المتغيرات في إعدادات واتساب.",
  132001: "القالب غير موجود بهذه اللغة أو لم تعتمده Meta بعد.",
  132012: "صيغة أحد متغيرات القالب غير صحيحة.",
  133010: "رقم الإرسال غير مسجّل في منصة واتساب للأعمال.",
};

export function describeMetaError(error = {}) {
  return META_REASONS[error.code] || "رفضت Meta الطلب. راجع التفاصيل التقنية.";
}

/** Call the Graph API. Resolves to { ok, status, json } (never throws on HTTP errors). */
export async function graphRequest(
  config,
  path,
  { method = "GET", body } = {},
) {
  const version = encodeURIComponent(config.version || DEFAULT_GRAPH_VERSION);
  const response = await fetch(
    `https://graph.facebook.com/${version}/${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  let json = {};
  try {
    json = await response.json();
  } catch {
    // Non-JSON is treated as a failure below.
  }
  return { ok: response.ok && !json.error, status: response.status, json };
}

/** Failed Graph call → our error fields (Meta's text only as `detail`). */
export function metaFailure(result) {
  const error = result.json?.error || {};
  return {
    httpStatus: result.status >= 400 && result.status < 500 ? 422 : 502,
    metaCode: error.code ?? null,
    error: describeMetaError(error),
    detail: error.error_data?.details || error.message || null,
  };
}

/** The sending number's public profile: proves the id + token work together. */
export async function fetchPhoneProfile(config) {
  const result = await graphRequest(
    config,
    `${encodeURIComponent(config.phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`,
  );
  if (!result.ok) return { ok: false, ...metaFailure(result) };
  return {
    ok: true,
    profile: {
      displayPhone: result.json.display_phone_number || null,
      verifiedName: result.json.verified_name || null,
      qualityRating: result.json.quality_rating || null,
    },
  };
}

/**
 * Meta rejects template parameters with new lines, tabs or more than four
 * spaces in a row. Keep a value on one line and within a safe length.
 */
export function cleanParam(value, max = 1000) {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim()
    .slice(0, max);
}

/** Template request body for Meta, or { error } if a variable is empty. */
export function buildTemplateMessage(config, to, values) {
  const template = {
    name: config.template,
    language: { code: config.language },
  };
  if (config.params.length) {
    const parameters = [];
    for (const key of config.params) {
      const text = String(values[key] || "").trim();
      // Meta rejects empty template parameters.
      if (!text) return { error: `لا توجد قيمة للمتغير {{${key}}}` };
      parameters.push({ type: "text", text });
    }
    template.components = [{ type: "body", parameters }];
  }
  return {
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template,
    },
  };
}

export const MAX_TEXT_LENGTH = 4096;

/**
 * Free-form text message. WhatsApp only delivers it inside the 24-hour
 * window after the customer's last message to the business; otherwise
 * Meta answers 131047. Returns { body } or { error }.
 */
export function buildTextMessage(to, text) {
  const body = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!body) return { error: "اكتب نص الرسالة أولًا." };
  if (body.length > MAX_TEXT_LENGTH) {
    return { error: `الرسالة أطول من ${MAX_TEXT_LENGTH} حرف.` };
  }
  return {
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      // Shows a preview of the checkout link.
      text: { preview_url: true, body },
    },
  };
}

/** POST any message body (template or text) to the sending number. */
export function sendTemplate(config, message) {
  return graphRequest(
    config,
    `${encodeURIComponent(config.phoneNumberId)}/messages`,
    { method: "POST", body: message },
  );
}

/** Variables in a template text, in order: "{{1}}", "{{name}}" → ["1", "name"]. */
export function templateVariables(text) {
  const names = [];
  for (const match of String(text || "").matchAll(/\{\{\s*([\w]+)\s*\}\}/g)) {
    if (!names.includes(match[1])) names.push(match[1]);
  }
  return names;
}

/** A Meta template → what the app shows and (later) fills. No secrets. */
export function normalizeTemplate(template) {
  const components = Array.isArray(template.components)
    ? template.components
    : [];
  const part = (type) =>
    components.find((c) => String(c.type).toUpperCase() === type);
  const header = part("HEADER");
  const body = part("BODY")?.text || "";
  const buttons = (part("BUTTONS")?.buttons || []).map((b) => ({
    type: b.type,
    text: b.text || "",
    url: b.url || null,
    phone: b.phone_number || null,
  }));
  return {
    id: String(template.id),
    name: template.name,
    language: template.language,
    status: template.status,
    category: template.category,
    parameterFormat: template.parameter_format || "POSITIONAL",
    header: header
      ? { format: header.format || "TEXT", text: header.text || null }
      : null,
    body,
    footer: part("FOOTER")?.text || null,
    buttons,
    variables: {
      header: templateVariables(header?.text),
      body: templateVariables(body),
      // A URL button with {{1}} takes one value (e.g. the product link).
      buttons: buttons.filter((b) => b.type === "URL" && /\{\{/.test(b.url))
        .length,
    },
  };
}

const TEMPLATE_FIELDS =
  "id,name,language,status,category,parameter_format,components";

/**
 * Every message template of a WhatsApp Business Account
 * (GET /{waba-id}/message_templates, up to maxPages × 100). Needs the
 * whatsapp_business_management permission on the token.
 * Resolves to { ok, templates } or { ok: false, … metaFailure }.
 */
export async function fetchTemplates(config, wabaId, { maxPages = 5 } = {}) {
  const base = `${encodeURIComponent(wabaId)}/message_templates?fields=${TEMPLATE_FIELDS}&limit=100`;
  const templates = [];
  let path = base;
  for (let page = 0; page < maxPages && path; page += 1) {
    const result = await graphRequest(config, path);
    if (!result.ok) return { ok: false, ...metaFailure(result) };
    templates.push(...(result.json.data || []).map(normalizeTemplate));
    const after = result.json.paging?.cursors?.after;
    path =
      result.json.paging?.next && after
        ? `${base}&after=${encodeURIComponent(after)}`
        : null;
  }
  return { ok: true, templates };
}
