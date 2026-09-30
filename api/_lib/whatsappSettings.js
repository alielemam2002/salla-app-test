/**
 * Per-merchant WhatsApp Cloud API settings, keyed by the Salla merchant id
 * from the verified embedded session. Stored in Upstash Redis; the access
 * token is encrypted (secretBox) and never returned to the browser.
 *
 * There is no shared fallback account: a merchant sends from the app only
 * after connecting their own account, and only while `enabled` is on.
 * Otherwise they can still send manually (wa.me).
 */

import { kvDel, kvGetJson, kvSetJson } from "./kv.js";
import { open, seal } from "./secretBox.js";
import { ALLOWED_PARAMS, DEFAULT_GRAPH_VERSION } from "./whatsappGraph.js";

const keyFor = (merchantId) => `wa:settings:${merchantId}`;

export const TEMPLATE_NAME_RE = /^[a-z0-9_]{1,512}$/;
export const LANGUAGE_RE = /^[a-z]{2,3}(_[A-Z]{2})?$/;
const ID_RE = /^\d{5,25}$/;
const MAX_PARAMS = 10;

/** Graph API version (META_GRAPH_VERSION, else the docs' current one). */
export function graphVersion(env = process.env) {
  return String(env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION).trim();
}

/**
 * Validate what the merchant typed. The token is optional when one is
 * already saved (leave it blank to keep it).
 * Returns { values } or { fields: { name: [message] } }.
 */
export function validateSettingsInput(
  input = {},
  { hasSavedToken = false } = {},
) {
  const fields = {};
  const phoneNumberId = String(input.phoneNumberId || "").trim();
  const wabaId = String(input.wabaId || "").trim();
  const accessToken = String(input.accessToken || "")
    .trim()
    .replace(/^Bearer\s+/i, "");
  const template = String(input.template || "").trim();
  const language = String(input.language || "").trim();
  const params = Array.isArray(input.params)
    ? input.params.map((p) => String(p).trim()).filter(Boolean)
    : [];

  if (!ID_RE.test(phoneNumberId))
    fields.phoneNumberId = [
      "استخدم معرّف رقم الهاتف (أرقام فقط) من إعداد واجهة البرمجة",
    ];
  if (wabaId && !ID_RE.test(wabaId))
    fields.wabaId = ["استخدم معرّف حساب واتساب للأعمال (أرقام فقط)"];
  if (accessToken) {
    if (accessToken.length < 20 || /\s/.test(accessToken)) {
      fields.accessToken = ["لا يبدو هذا رمز وصول صالحًا من Meta"];
    }
  } else if (!hasSavedToken) {
    fields.accessToken = ["رمز الوصول مطلوب"];
  }
  if (!TEMPLATE_NAME_RE.test(template)) {
    fields.template = [
      "اسم القالب يتكون من أحرف إنجليزية صغيرة وأرقام و _ فقط",
    ];
  }
  if (!LANGUAGE_RE.test(language))
    fields.language = ["استخدم رمز لغة مثل ar أو en_US"];
  const unknown = params.filter((p) => !ALLOWED_PARAMS.has(p));
  if (unknown.length)
    fields.params = [`متغيرات غير معروفة: ${unknown.join(", ")}`];
  else if (params.length > MAX_PARAMS)
    fields.params = [`الحد الأقصى ${MAX_PARAMS} متغيرات`];

  if (Object.keys(fields).length) return { fields };
  return {
    values: { phoneNumberId, wabaId, accessToken, template, language, params },
  };
}

export async function loadStored(merchantId) {
  return kvGetJson(keyFor(merchantId));
}

/** Save (token re-encrypted only when a new one was entered). */
export async function saveSettings(merchantId, values, { stored, profile }) {
  const record = {
    phoneNumberId: values.phoneNumberId,
    wabaId: values.wabaId || null,
    template: values.template,
    language: values.language,
    params: values.params,
    token: values.accessToken ? seal(values.accessToken) : stored.token,
    tokenLast4: values.accessToken
      ? values.accessToken.slice(-4)
      : stored.tokenLast4,
    profile: profile || null,
    // Sending from the app is on right after connecting; the merchant can
    // switch it off without losing the settings.
    enabled: stored.enabled ?? true,
    updatedAt: new Date().toISOString(),
  };
  await kvSetJson(keyFor(merchantId), record);
  return record;
}

/** Turn sending from the app on or off, keeping everything else. */
export async function setEnabled(merchantId, stored, enabled) {
  const record = {
    ...stored,
    enabled: Boolean(enabled),
    updatedAt: new Date().toISOString(),
  };
  await kvSetJson(keyFor(merchantId), record);
  return record;
}

export async function deleteSettings(merchantId) {
  await kvDel(keyFor(merchantId));
}

/** What the browser may see: never the token, only its last 4 characters. */
export function publicSettings(record) {
  if (!record) return null;
  return {
    phoneNumberId: record.phoneNumberId,
    wabaId: record.wabaId,
    template: record.template,
    language: record.language,
    params: record.params || [],
    tokenLast4: record.tokenLast4 || null,
    profile: record.profile || null,
    enabled: record.enabled !== false,
    updatedAt: record.updatedAt,
  };
}

/** Stored record → send config (decrypts the token). */
export function recordToConfig(record, env = process.env) {
  return {
    token: open(record.token),
    phoneNumberId: record.phoneNumberId,
    template: record.template,
    language: record.language,
    params: record.params || [],
    invalidParams: (record.params || []).filter((p) => !ALLOWED_PARAMS.has(p)),
    version: graphVersion(env),
  };
}
