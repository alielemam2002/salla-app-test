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
  0: "Meta couldn't authenticate the access token. Generate a new one.",
  190: "The WhatsApp access token expired. Generate a new one and save it in WhatsApp settings.",
  10: "The token doesn't have WhatsApp messaging permission.",
  200: "No WhatsApp access token was sent.",
  100: "Meta rejected a parameter in the request (check the Phone Number ID).",
  130429: "Meta's sending limit was reached. Wait and try again.",
  131026: "The customer's number isn't on WhatsApp or can't receive messages.",
  131030:
    "Meta's test number can only message recipients you added in API Setup.",
  131031: "The WhatsApp Business account is restricted.",
  131042: "The WhatsApp Business account has a billing problem.",
  131047:
    "The 24-hour window is closed; only an approved template can be sent.",
  131049:
    "Meta held this marketing message to limit messages per customer. Try after 24 hours.",
  131056: "Too many messages to this customer in a short time.",
  132000:
    "The number of template variables doesn't match the template. Check the variables in WhatsApp settings.",
  132001: "The template doesn't exist in this language or isn't approved yet.",
  132012: "A template variable has the wrong format.",
  133010:
    "The sending phone number isn't registered on the WhatsApp Business Platform.",
};

export function describeMetaError(error = {}) {
  return (
    META_REASONS[error.code] ||
    "Meta rejected the request. See the technical details."
  );
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
      if (!text) return { error: `No value for {{${key}}}` };
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

export function sendTemplate(config, message) {
  return graphRequest(
    config,
    `${encodeURIComponent(config.phoneNumberId)}/messages`,
    { method: "POST", body: message },
  );
}
