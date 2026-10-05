/**
 * Per-merchant WhatsApp Cloud API settings, keyed by the Salla merchant id
 * from the verified embedded session. Stored in Upstash Redis; the access
 * token is encrypted (secretBox) and never returned to the browser.
 *
 * There is no shared fallback account: a merchant sends from the app only
 * after connecting their own account, and only while `enabled` is on.
 * Otherwise they can still send manually (wa.me).
 */

import { kvConfigured, kvDel, kvGetJson, kvSetJson } from "./kv.js";
import { encryptionConfigured, open, seal } from "./secretBox.js";
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
 * The account part: Phone Number ID, WABA ID and token. The token is
 * optional when one is already saved (leave it blank to keep it).
 */
function checkAccount(input, { hasSavedToken, requireWaba }) {
  const fields = {};
  const phoneNumberId = String(input.phoneNumberId || "").trim();
  const wabaId = String(input.wabaId || "").trim();
  const accessToken = String(input.accessToken || "")
    .trim()
    .replace(/^Bearer\s+/i, "");
  if (!ID_RE.test(phoneNumberId))
    fields.phoneNumberId = [
      "استخدم معرّف رقم الهاتف (أرقام فقط) من إعداد واجهة البرمجة",
    ];
  if (requireWaba && !wabaId) {
    fields.wabaId = ["معرّف حساب واتساب للأعمال مطلوب لعرض قوالبك"];
  } else if (wabaId && !ID_RE.test(wabaId)) {
    fields.wabaId = ["استخدم معرّف حساب واتساب للأعمال (أرقام فقط)"];
  }
  if (accessToken) {
    if (accessToken.length < 20 || /\s/.test(accessToken)) {
      fields.accessToken = ["لا يبدو هذا رمز وصول صالحًا من Meta"];
    }
  } else if (!hasSavedToken) {
    fields.accessToken = ["رمز الوصول مطلوب"];
  }
  return { fields, values: { phoneNumberId, wabaId, accessToken } };
}

/**
 * Settings page: the account only (Returns { values } or { fields }).
 * Templates come from Meta, not from typing.
 */
export function validateAccountInput(
  input = {},
  { hasSavedToken = false } = {},
) {
  const { fields, values } = checkAccount(input, {
    hasSavedToken,
    requireWaba: true,
  });
  return Object.keys(fields).length ? { fields } : { values };
}

/**
 * Validate what the merchant typed (account + cart reminder template).
 * Returns { values } or { fields: { name: [message] } }.
 */
export function validateSettingsInput(
  input = {},
  { hasSavedToken = false } = {},
) {
  const account = checkAccount(input, { hasSavedToken, requireWaba: false });
  const fields = { ...account.fields };
  const { phoneNumberId, wabaId, accessToken } = account.values;
  const template = String(input.template || "").trim();
  const language = String(input.language || "").trim();
  const params = Array.isArray(input.params)
    ? input.params.map((p) => String(p).trim()).filter(Boolean)
    : [];

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

/**
 * Save the account from the Settings page (or Embedded Signup). The cart
 * reminder template (if any) is kept; features pick templates separately.
 * `source`: "embedded_signup" (Connect with Facebook) or "manual" (typed);
 * `pin`: the number's two-step PIN set by Embedded Signup (stored sealed,
 * reused when the same number connects again).
 */
export async function saveAccount(
  merchantId,
  values,
  { stored, profile, source, pin },
) {
  const record = {
    ...(stored || {}),
    phoneNumberId: values.phoneNumberId,
    wabaId: values.wabaId,
    token: values.accessToken ? seal(values.accessToken) : stored.token,
    tokenLast4: values.accessToken
      ? values.accessToken.slice(-4)
      : stored.tokenLast4,
    profile: profile || null,
    source: source || (values.accessToken ? "manual" : stored?.source),
    enabled: stored?.enabled ?? true,
    updatedAt: new Date().toISOString(),
  };
  if (pin) record.pin = seal(pin);
  else if (stored?.phoneNumberId !== values.phoneNumberId) delete record.pin;
  await kvSetJson(keyFor(merchantId), record);
  return record;
}

// The merchant's templates as last read from Meta (Settings → Templates).
const templatesKey = (merchantId) => `wa:templates:${merchantId}`;

export function loadTemplates(merchantId) {
  return kvGetJson(templatesKey(merchantId));
}

export async function saveTemplates(merchantId, templates) {
  const snapshot = { syncedAt: new Date().toISOString(), templates };
  await kvSetJson(templatesKey(merchantId), snapshot);
  return snapshot;
}

// Each feature's chosen template + variables (templateBinding.js), checked
// against the library when saved: { cart?: binding, replenish?: binding }.
const bindingsKey = (merchantId) => `wa:bindings:${merchantId}`;

export async function loadBindings(merchantId) {
  return (await kvGetJson(bindingsKey(merchantId))) || {};
}

/** binding = null forgets the feature's template. */
export async function saveBinding(merchantId, feature, binding) {
  const bindings = await loadBindings(merchantId);
  if (binding) bindings[feature] = binding;
  else delete bindings[feature];
  await kvSetJson(bindingsKey(merchantId), bindings);
  return bindings;
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
  await kvDel(templatesKey(merchantId));
  // The chosen templates belong to the account being removed.
  await kvDel(bindingsKey(merchantId));
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
    source: record.source || "manual",
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

/** Upstash Redis and WA_SETTINGS_KEY are both set up on the server. */
export const storageReady = () => kvConfigured() && encryptionConfigured();

/**
 * The merchant's own WhatsApp setup; there is no shared fallback.
 * `unreadable`: saved with a different WA_SETTINGS_KEY, so the token must
 * be entered again.
 */
export async function resolveConfig(merchantId) {
  if (!storageReady()) return { stored: null, config: null, enabled: false };
  const stored = await loadStored(merchantId);
  if (!stored) return { stored: null, config: null, enabled: false };
  const enabled = stored.enabled !== false;
  try {
    return { stored, enabled, config: recordToConfig(stored) };
  } catch {
    return { stored, enabled, config: null, unreadable: true };
  }
}
