/**
 * Vercel Serverless Function - WhatsApp Cloud API for cart recovery.
 *
 * Every merchant connects their own WhatsApp Business account in the app
 * (WhatsApp settings). Settings are stored per Salla merchant (from the
 * verified embedded session) in Upstash Redis, with the access token
 * encrypted. Until a merchant saves settings, the META_WA_* env vars are
 * used as a server default.
 *
 * Actions (all need a valid embedded session token):
 * - status           which setup is active (merchant / server / none)
 * - settings_get     the merchant's settings, token masked
 * - settings_save    validate, check with Meta (phone number profile), save
 * - settings_delete  forget the merchant's settings
 * - send_test        send the template with sample values to a number
 * - send             send the template for one abandoned cart; the cart is
 *                    read from Salla (GET /admin/v2/carts/abandoned/{id})
 *
 * Env: WA_SETTINGS_KEY (32 bytes, base64) + Upstash (KV_REST_API_URL /
 * KV_REST_API_TOKEN) for per-merchant settings; optional META_WA_TOKEN,
 * META_WA_PHONE_NUMBER_ID, META_WA_TEMPLATE_NAME, META_WA_TEMPLATE_LANG,
 * META_WA_TEMPLATE_PARAMS, META_GRAPH_VERSION as the server default.
 */

import { introspectEmbeddedToken, merchantApi } from "./_lib/salla.js";
import { kvConfigured } from "./_lib/kv.js";
import { encryptionConfigured, open } from "./_lib/secretBox.js";
import {
  buildTemplateMessage,
  fetchPhoneProfile,
  metaFailure,
  sendTemplate,
} from "./_lib/whatsappGraph.js";
import {
  deleteSettings,
  envConfig,
  loadStored,
  publicSettings,
  recordToConfig,
  saveSettings,
  validateSettingsInput,
} from "./_lib/whatsappSettings.js";
import {
  SAMPLE_CART,
  cartMessageValues,
  whatsappNumber,
} from "../src/utils/cartRecovery/whatsappMessage.js";

const ERROR_STATUS = {
  token_not_configured: 500,
  token_expired: 401,
  missing_scope: 403,
};

const fail = (status, code, error, extra = {}) =>
  Response.json({ success: false, status, code, error, ...extra }, { status });

const storageReady = () => kvConfigured() && encryptionConfigured();

/** The config to send with: the merchant's own, else the server default. */
async function resolveConfig(merchantId) {
  if (storageReady()) {
    const stored = await loadStored(merchantId);
    if (stored) {
      try {
        return { source: "merchant", stored, config: recordToConfig(stored) };
      } catch {
        // Saved with a different WA_SETTINGS_KEY: the token must be re-entered.
        return { source: "merchant", stored, config: null, unreadable: true };
      }
    }
  }
  const fallback = envConfig();
  return fallback
    ? { source: "server", stored: null, config: fallback }
    : { source: null, stored: null, config: null };
}

const localeOf = (config) => (config.language.startsWith("ar") ? "ar" : "en");

/** Send one template message; returns a Response. */
async function deliver(config, to, values) {
  if (config.invalidParams?.length) {
    return fail(
      500,
      "whatsapp_bad_config",
      `Unknown template variables: ${config.invalidParams.join(", ")}`,
    );
  }
  const message = buildTemplateMessage(config, to, values);
  if (message.error) return fail(422, "missing_value", message.error);

  const result = await sendTemplate(config, message.body);
  if (!result.ok) {
    const failure = metaFailure(result);
    console.error("WhatsApp send failed:", failure.metaCode);
    return fail(failure.httpStatus, "meta_error", failure.error, {
      metaCode: failure.metaCode,
      detail: failure.detail,
    });
  }
  const sent = result.json.messages?.[0] || {};
  return Response.json({
    success: true,
    messageId: sent.id || null,
    // "accepted" means Meta took it, not that it was delivered.
    status: sent.message_status || "accepted",
  });
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

  try {
    const session = await introspectEmbeddedToken(token, appId);
    if (!session.ok) {
      return fail(session.status, "session_invalid", session.error);
    }
    const merchantId = String(session.data.merchant_id);

    switch (action) {
      case "status": {
        const { source, stored, config, unreadable } =
          await resolveConfig(merchantId);
        // Never return the token.
        return Response.json({
          success: true,
          configured: Boolean(config),
          source,
          storageReady: storageReady(),
          template: config?.template || null,
          language: config?.language || null,
          params: config?.params || [],
          invalidParams: config?.invalidParams || [],
          profile: stored?.profile || null,
          tokenUnreadable: Boolean(unreadable),
        });
      }

      case "settings_get": {
        const ready = storageReady();
        const stored = ready ? await loadStored(merchantId) : null;
        return Response.json({
          success: true,
          storageReady: ready,
          settings: publicSettings(stored),
        });
      }

      case "settings_save": {
        if (!storageReady()) {
          return fail(
            503,
            "storage_not_configured",
            "Settings storage isn't set up on the server (Upstash Redis + WA_SETTINGS_KEY).",
          );
        }
        const stored = await loadStored(merchantId);
        const { values, fields } = validateSettingsInput(body.settings, {
          hasSavedToken: Boolean(stored?.token),
        });
        if (fields) {
          return fail(422, "validation_failed", "Some settings are invalid", {
            fields,
          });
        }
        // Check the id + token with Meta before saving anything.
        let savedToken = null;
        if (!values.accessToken) {
          try {
            savedToken = open(stored.token);
          } catch {
            return fail(
              422,
              "validation_failed",
              "Enter the access token again",
              {
                fields: {
                  accessToken: [
                    "The saved token can't be read anymore. Enter it again.",
                  ],
                },
              },
            );
          }
        }
        const probe = {
          token: values.accessToken || savedToken,
          phoneNumberId: values.phoneNumberId,
          version: envConfig()?.version,
        };
        const check = await fetchPhoneProfile(probe);
        if (!check.ok) {
          return fail(check.httpStatus, "meta_error", check.error, {
            metaCode: check.metaCode,
            detail: check.detail,
          });
        }
        const record = await saveSettings(merchantId, values, {
          stored: stored || {},
          profile: check.profile,
        });
        return Response.json({
          success: true,
          settings: publicSettings(record),
        });
      }

      case "settings_delete": {
        if (storageReady()) await deleteSettings(merchantId);
        return Response.json({ success: true });
      }

      case "send_test": {
        const { config, unreadable } = await resolveConfig(merchantId);
        if (!config) {
          return fail(
            503,
            "whatsapp_not_configured",
            unreadable
              ? "Your saved WhatsApp token can't be read anymore. Enter it again in WhatsApp settings."
              : "Connect WhatsApp in WhatsApp settings first.",
          );
        }
        const to = whatsappNumber(body.to);
        if (!to) {
          return fail(
            422,
            "bad_number",
            "Enter a full international number, e.g. +966500000000.",
          );
        }
        return deliver(
          config,
          to,
          cartMessageValues(SAMPLE_CART, { locale: localeOf(config) }),
        );
      }

      case "send": {
        const { config, unreadable } = await resolveConfig(merchantId);
        if (!config) {
          return fail(
            503,
            "whatsapp_not_configured",
            unreadable
              ? "Your saved WhatsApp token can't be read anymore. Enter it again in WhatsApp settings."
              : "Connect WhatsApp in WhatsApp settings first.",
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
        return deliver(
          config,
          to,
          cartMessageValues(cart, { locale: localeOf(config), couponCode }),
        );
      }

      default:
        return fail(400, "bad_request", `Unknown action: "${action}"`);
    }
  } catch (error) {
    console.error("WhatsApp endpoint failed:", error.code || error.message);
    return fail(
      error.status || ERROR_STATUS[error.code] || 500,
      error.code || "server_error",
      error.message || "Internal server error",
    );
  }
}
