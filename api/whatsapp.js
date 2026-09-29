/**
 * Vercel Serverless Function - Send an abandoned-cart reminder through the
 * WhatsApp Cloud API (Meta). Proof of concept: one cart per request, sent
 * when the merchant presses the button. No scheduling, no storage.
 *
 * Meta: POST https://graph.facebook.com/{version}/{phone-number-id}/messages
 * with a pre-approved *template* (a business can't start a chat with free
 * text). docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 *
 * The cart (customer mobile, total, checkout_url, status) is read from Salla
 * here, never taken from the browser: GET /admin/v2/carts/abandoned/{id}.
 *
 * Env (server only, never sent to the browser):
 * - META_WA_TOKEN            access token (test token or System User token)
 * - META_WA_PHONE_NUMBER_ID  "Phone number ID" from API Setup
 * - META_WA_TEMPLATE_NAME    approved template (default: hello_world)
 * - META_WA_TEMPLATE_LANG    its language code (default: en_US)
 * - META_WA_TEMPLATE_PARAMS  body variables in order, comma-separated, from:
 *                            customer_name, cart_total, cart_items,
 *                            checkout_url, coupon_code (default: none)
 * - META_GRAPH_VERSION       Graph API version (default: v23.0, as in Meta's docs)
 */

import { introspectEmbeddedToken, merchantApi } from "./_lib/salla.js";
import {
  TEMPLATE_VARIABLES,
  cartMessageValues,
  whatsappNumber,
} from "../src/utils/cartRecovery/whatsappMessage.js";

const ERROR_STATUS = {
  token_not_configured: 500,
  token_expired: 401,
  missing_scope: 403,
};

const ALLOWED_PARAMS = new Set(TEMPLATE_VARIABLES.map((v) => v.key));

const fail = (status, code, error, extra = {}) =>
  Response.json({ success: false, status, code, error, ...extra }, { status });

/** WhatsApp settings from env; `configured` is false if a key is missing. */
export function readConfig(env = process.env) {
  const params = String(env.META_WA_TEMPLATE_PARAMS || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    configured: Boolean(env.META_WA_TOKEN && env.META_WA_PHONE_NUMBER_ID),
    token: String(env.META_WA_TOKEN || "").trim(),
    phoneNumberId: String(env.META_WA_PHONE_NUMBER_ID || "").trim(),
    template: String(env.META_WA_TEMPLATE_NAME || "hello_world").trim(),
    language: String(env.META_WA_TEMPLATE_LANG || "en_US").trim(),
    params,
    invalidParams: params.filter((p) => !ALLOWED_PARAMS.has(p)),
    version: String(env.META_GRAPH_VERSION || "v23.0").trim(),
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
      if (!text) return { error: `No value for {{${key}}} in this cart` };
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

// Meta error code → short, actionable reason (codes from Meta's error table).
const META_REASONS = {
  0: "Meta couldn't authenticate the access token. Generate a new one.",
  190: "The WhatsApp access token expired. Generate a new one and update META_WA_TOKEN.",
  10: "The token doesn't have WhatsApp messaging permission.",
  200: "No WhatsApp access token was sent.",
  100: "Meta rejected a parameter in the request.",
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
    "The number of template variables doesn't match the template. Check META_WA_TEMPLATE_PARAMS.",
  132001: "The template doesn't exist in this language or isn't approved yet.",
  132012: "A template variable has the wrong format.",
  133010:
    "The sending phone number isn't registered on the WhatsApp Business Platform.",
};

export function describeMetaError(error = {}) {
  return (
    META_REASONS[error.code] ||
    "Meta rejected the message. See the technical details."
  );
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "Invalid JSON body");
  }

  const { token } = body;
  const appId = process.env.SALLA_APP_ID || body.appId;
  const action = String(body.action || "status").toLowerCase();
  if (!token) return fail(400, "bad_request", "Token is required");
  if (!appId) return fail(400, "bad_request", "App ID is required");

  const config = readConfig();

  try {
    const session = await introspectEmbeddedToken(token, appId);
    if (!session.ok) {
      return fail(session.status, "session_invalid", session.error);
    }

    if (action === "status") {
      // Never return the token itself.
      return Response.json({
        success: true,
        configured: config.configured,
        template: config.template,
        language: config.language,
        params: config.params,
        invalidParams: config.invalidParams,
      });
    }

    if (action !== "send") {
      return fail(400, "bad_request", `Unknown action: "${action}"`);
    }
    if (!config.configured) {
      return fail(
        503,
        "whatsapp_not_configured",
        "Add META_WA_TOKEN and META_WA_PHONE_NUMBER_ID in Vercel, then redeploy.",
      );
    }
    if (config.invalidParams.length) {
      return fail(
        500,
        "whatsapp_bad_config",
        `Unknown META_WA_TEMPLATE_PARAMS: ${config.invalidParams.join(", ")}`,
      );
    }

    const cartId = String(body.cartId || "");
    if (!/^\d+$/.test(cartId)) {
      return fail(400, "bad_request", "A numeric cart ID is required");
    }

    const { status, body: result } = await merchantApi(
      `/carts/abandoned/${encodeURIComponent(cartId)}`,
    );
    if (!result.success) {
      return fail(
        status >= 400 ? status : 502,
        "salla_api_error",
        result.error?.message || "Failed to load the cart",
      );
    }
    const cart = result.data || {};
    if (cart.status === "purchased") {
      return fail(
        409,
        "cart_purchased",
        "The customer already completed this order.",
      );
    }
    const to = whatsappNumber(cart.customer?.mobile);
    if (!to) {
      return fail(
        422,
        "no_phone",
        "Salla has no international mobile number for this customer.",
      );
    }

    const couponCode = /^[\w-]{1,40}$/.test(String(body.couponCode || ""))
      ? body.couponCode
      : "";
    const values = cartMessageValues(cart, {
      locale: config.language.startsWith("ar") ? "ar" : "en",
      couponCode,
    });
    const message = buildTemplateMessage(config, to, values);
    if (message.error) return fail(422, "missing_value", message.error);

    const response = await fetch(
      `https://graph.facebook.com/${encodeURIComponent(config.version)}/${encodeURIComponent(config.phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message.body),
      },
    );
    let meta = {};
    try {
      meta = await response.json();
    } catch {
      // Non-JSON from Meta is handled as a failure below.
    }

    if (!response.ok || meta.error) {
      const metaError = meta.error || {};
      console.error("WhatsApp send failed:", metaError.code, metaError.type);
      return fail(
        response.status >= 400 && response.status < 500 ? 422 : 502,
        "meta_error",
        describeMetaError(metaError),
        {
          metaCode: metaError.code ?? null,
          // Meta's own text, for the "technical details" box only.
          detail: metaError.error_data?.details || metaError.message || null,
        },
      );
    }

    const sent = meta.messages?.[0] || {};
    return Response.json({
      success: true,
      messageId: sent.id || null,
      // "accepted" means Meta took it, not that it was delivered.
      status: sent.message_status || "accepted",
    });
  } catch (error) {
    console.error("WhatsApp endpoint failed:", error.message);
    return fail(
      error.status || ERROR_STATUS[error.code] || 500,
      error.code || "server_error",
      error.message || "Internal server error",
    );
  }
}
