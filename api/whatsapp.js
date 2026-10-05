/**
 * Vercel Serverless Function - WhatsApp Cloud API for cart recovery.
 *
 * Every merchant connects their own WhatsApp Business account in the app
 * (WhatsApp settings). Settings are stored per Salla merchant (from the
 * verified embedded session) in Upstash Redis, with the access token
 * encrypted. There is no shared account: until a merchant connects (and
 * while their "send from the app" switch is off), reminders are manual only.
 *
 * Actions (all need a valid embedded session token):
 * - status           connected? switched on? which template?
 * - settings_get     the merchant's settings, token masked
 * - settings_save    validate, check with Meta (phone number profile), save
 * - settings_enable  turn sending from the app on/off ({ enabled })
 * - settings_delete  forget the merchant's settings (and templates)
 * - account_save     Settings page: Phone Number ID + WABA ID + token only
 *                    (checked with Meta), then reads the templates
 * - templates_sync   read the templates again from Meta
 *                    (GET /{waba-id}/message_templates) and keep a snapshot
 * - templates_list   the last snapshot (no Meta call)
 * - binding_get      each feature's chosen template ({ cart, replenish })
 * - binding_save     { feature, binding | null }: a template from the
 *                    library + what fills each variable, checked against the
 *                    library (send / send_test use the cart one; campaigns
 *                    send `binding` with every send_campaign)
 * - send_test        send the template with sample values to a number
 * - send             send the template for one abandoned cart; the cart is
 *                    read from Salla (GET /admin/v2/carts/abandoned/{id}).
 *                    With mode "text", sends the merchant's text instead
 *                    (WhatsApp delivers it only inside the 24-hour window)
 * - send_campaign    send a campaign template to one customer (the browser
 *                    sends a campaign one customer at a time)
 * - signup_config    Embedded Signup ("connect with Facebook"): the public
 *                    app ID + configuration ID, or available: false
 * - signup_complete  { code, wabaId, phoneNumberId } from the popup: exchange
 *                    the code, subscribe the WABA, register the number, save
 *                    the account, read the templates (api/_lib/metaSignup.js)
 *
 * Env: WA_SETTINGS_KEY (32 bytes, base64), Upstash (KV_REST_API_URL /
 * KV_REST_API_TOKEN), optional META_GRAPH_VERSION; Embedded Signup:
 * META_APP_ID, META_APP_SECRET, META_ES_CONFIG_ID.
 */

import { introspectEmbeddedToken, sallaApiFor } from "./_lib/salla.js";
import { open } from "./_lib/secretBox.js";
import {
  exchangeSignupCode,
  newPin,
  registerPhone,
  signupConfig,
  subscribeApp,
} from "./_lib/metaSignup.js";
import {
  buildBoundMessage,
  buildTemplateMessage,
  buildTextMessage,
  cleanParam,
  fetchPhoneProfile,
  fetchTemplates,
  metaFailure,
  sendTemplate,
} from "./_lib/whatsappGraph.js";
import {
  deleteSettings,
  graphVersion,
  loadBindings,
  loadStored,
  loadTemplates,
  publicSettings,
  resolveConfig,
  saveAccount,
  saveBinding,
  saveSettings,
  saveTemplates,
  setEnabled,
  storageReady,
  LANGUAGE_RE,
  TEMPLATE_NAME_RE,
  validateAccountInput,
  validateSettingsInput,
} from "./_lib/whatsappSettings.js";
import {
  SAMPLE_CART,
  cartMessageValues,
  whatsappNumber,
} from "../src/utils/cartRecovery/whatsappMessage.js";
import {
  BINDING_SOURCES,
  resolveBinding,
} from "../src/utils/whatsapp/templateBinding.js";

const ERROR_STATUS = {
  store_not_authorized: 403,
  token_expired: 401,
  missing_scope: 403,
};

const fail = (status, code, error, extra = {}) =>
  Response.json({ success: false, status, code, error, ...extra }, { status });

const notConnected = (unreadable) =>
  fail(
    503,
    "whatsapp_not_configured",
    unreadable
      ? "تعذّرت قراءة رمز الوصول المحفوظ لواتساب. أدخله مرة أخرى في إعدادات واتساب."
      : "اربط حساب واتساب للأعمال من إعدادات واتساب أولًا. حتى ذلك الحين أرسل التذكيرات يدويًا.",
  );

const localeOf = (config) => (config.language.startsWith("ar") ? "ar" : "en");

const CAMPAIGN_SOURCES = new Set(["customer_name", "coupon_code", "custom"]);
const FALLBACK_NAME = { ar: "عميلنا العزيز", en: "there" };

/**
 * A campaign's template + variables on top of the merchant's account.
 * `params` is [{ source: customer_name | coupon_code | custom, value }] in
 * {{1}}, {{2}}… order. Returns { config, values(name) } or { error }.
 */
export function campaignConfig(base, body) {
  const template = String(body.template || "").trim();
  const language = String(body.language || "").trim();
  if (!TEMPLATE_NAME_RE.test(template)) return { error: "اسم القالب غير صالح" };
  if (!LANGUAGE_RE.test(language)) return { error: "لغة القالب غير صالحة" };
  const params = Array.isArray(body.params) ? body.params : [];
  if (params.length > 10) return { error: "الحد الأقصى 10 متغيرات للقالب" };
  for (const p of params) {
    if (!CAMPAIGN_SOURCES.has(p?.source))
      return { error: "نوع المتغير غير معروف" };
    if (p.source !== "customer_name" && !cleanParam(p.value)) {
      return { error: "يجب إدخال قيمة لكل متغير" };
    }
  }
  const keys = params.map((_, i) => `v${i + 1}`);
  const locale = language.startsWith("ar") ? "ar" : "en";
  return {
    config: { ...base, template, language, params: keys, invalidParams: [] },
    values: (customerName) => {
      const first = String(customerName || "")
        .trim()
        .split(/\s+/)[0];
      const out = {};
      params.forEach((p, i) => {
        out[keys[i]] =
          p.source === "customer_name"
            ? cleanParam(first || FALLBACK_NAME[locale], 60)
            : cleanParam(p.value);
      });
      return out;
    },
  };
}

/** Send one template message; returns a Response. */
async function deliver(config, to, values) {
  if (config.invalidParams?.length) {
    return fail(
      500,
      "whatsapp_bad_config",
      `متغيرات قالب غير معروفة: ${config.invalidParams.join(", ")}`,
    );
  }
  const message = buildTemplateMessage(config, to, values);
  if (message.error) return fail(422, "missing_value", message.error);
  return post(config, message.body);
}

/** Send a feature's chosen template (binding); returns a Response. */
async function deliverBound(config, binding, to, values) {
  const message = buildBoundMessage(binding, to, values);
  if (message.error) return fail(422, "missing_value", message.error);
  return post(config, message.body);
}

const bindingLocale = (binding) =>
  String(binding.language).startsWith("ar") ? "ar" : "en";

const couponOf = (body) =>
  /^[\w-]{1,40}$/.test(String(body.couponCode || "")) ? body.couponCode : "";

// Features whose template is saved on the server (campaigns send theirs
// with every message).
const SAVED_BINDING_FEATURES = new Set(["cart", "replenish"]);

/** Send a free-form text message (24-hour window only); returns a Response. */
async function deliverText(config, to, text) {
  const message = buildTextMessage(to, text);
  if (message.error) return fail(422, "missing_value", message.error);
  return post(config, message.body);
}

/** POST a built message to Meta and turn the answer into a Response. */
async function post(config, messageBody) {
  const result = await sendTemplate(config, messageBody);
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

const noStorage = () =>
  fail(
    503,
    "storage_not_configured",
    "تخزين الإعدادات غير مفعّل على الخادم (Upstash Redis و WA_SETTINGS_KEY).",
  );

/**
 * Check the Phone Number ID + token with Meta before saving anything. A
 * blank token means "keep the saved one". Resolves to { token, profile }
 * or { response } (the error to return).
 */
async function checkWithMeta(values, stored) {
  let token = values.accessToken;
  if (!token) {
    try {
      token = open(stored.token);
    } catch {
      return {
        response: fail(422, "validation_failed", "أدخل رمز الوصول مرة أخرى", {
          fields: {
            accessToken: ["تعذّرت قراءة الرمز المحفوظ. أدخله مرة أخرى."],
          },
        }),
      };
    }
  }
  const check = await fetchPhoneProfile({
    token,
    phoneNumberId: values.phoneNumberId,
    version: graphVersion(),
  });
  if (!check.ok) {
    return {
      response: fail(check.httpStatus, "meta_error", check.error, {
        metaCode: check.metaCode,
        detail: check.detail,
      }),
    };
  }
  return { token, profile: check.profile };
}

// Reading templates needs other rights than sending: explain those errors.
const TEMPLATE_ERRORS = {
  10: "رمز الوصول لا يملك صلاحية whatsapp_business_management لقراءة القوالب. أضفها للرمز من Meta.",
  200: "رمز الوصول لا يملك صلاحية whatsapp_business_management لقراءة القوالب. أضفها للرمز من Meta.",
  100: "تحقق من معرّف حساب واتساب للأعمال (WABA ID): رفضته Meta.",
};

/** Read the templates from Meta and keep a snapshot for the app. */
async function syncTemplates(merchantId, config, wabaId) {
  const result = await fetchTemplates(config, wabaId);
  if (!result.ok) {
    return {
      error: TEMPLATE_ERRORS[result.metaCode] || result.error,
      metaCode: result.metaCode,
      detail: result.detail,
      status: result.httpStatus,
    };
  }
  return { snapshot: await saveTemplates(merchantId, result.templates) };
}

const META_ID_RE = /^\d{5,25}$/;

/**
 * Embedded Signup finished in the merchant's browser. The code is valid
 * for about 30 seconds, so it is exchanged first. Subscribing the WABA and
 * registering the number can fail without losing the connection: they come
 * back as warnings.
 */
async function completeSignup(merchantId, body) {
  if (!signupConfig()) {
    return fail(
      503,
      "signup_not_configured",
      "الربط عبر فيسبوك غير مفعّل على الخادم بعد (META_APP_ID و META_APP_SECRET و META_ES_CONFIG_ID).",
    );
  }
  if (!storageReady()) return noStorage();
  const code = String(body.code || "").trim();
  const wabaId = String(body.wabaId || "").trim();
  const phoneNumberId = String(body.phoneNumberId || "").trim();
  if (!code || code.length > 4096) {
    return fail(400, "bad_request", "رمز الربط من فيسبوك مطلوب");
  }
  if (!META_ID_RE.test(wabaId) || !META_ID_RE.test(phoneNumberId)) {
    return fail(
      422,
      "validation_failed",
      "لم تصل معرّفات حساب واتساب والرقم من نافذة فيسبوك. أكمل خطوات الربط حتى النهاية.",
    );
  }

  const version = graphVersion();
  const exchange = await exchangeSignupCode(code, version);
  if (!exchange.ok) {
    return fail(422, "signup_code_rejected", exchange.error, {
      detail: exchange.detail,
    });
  }
  const config = { token: exchange.token, version };
  const check = await fetchPhoneProfile({ ...config, phoneNumberId });
  if (!check.ok) {
    return fail(check.httpStatus, "meta_error", check.error, {
      metaCode: check.metaCode,
      detail: check.detail,
    });
  }

  const warnings = [];
  const subscribed = await subscribeApp(config, wabaId);
  if (!subscribed.ok) {
    warnings.push(`تعذّر ربط إشعارات Meta بحسابك: ${subscribed.error}`);
  }
  const stored = await loadStored(merchantId);
  // The same number connecting again keeps its PIN: a new one would fail.
  let pin = null;
  if (stored?.pin && stored.phoneNumberId === phoneNumberId) {
    try {
      pin = open(stored.pin);
    } catch {
      pin = null;
    }
  }
  pin = pin || newPin();
  const registered = await registerPhone(config, phoneNumberId, pin);
  if (!registered.ok) {
    warnings.push(
      `تعذّر تفعيل الرقم للإرسال عبر واجهة البرمجة: ${registered.error}`,
    );
  }

  const record = await saveAccount(
    merchantId,
    { phoneNumberId, wabaId, accessToken: exchange.token },
    {
      stored: stored || {},
      profile: check.profile,
      source: "embedded_signup",
      pin: registered.ok ? pin : null,
    },
  );
  const sync = await syncTemplates(merchantId, config, wabaId);
  return Response.json({
    success: true,
    settings: publicSettings(record),
    templates: sync.snapshot || null,
    templatesError: sync.error || null,
    warnings,
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "تعذّر قراءة الطلب");
  }

  const { token } = body;
  const appId = process.env.SALLA_APP_ID || body.appId;
  const action = String(body.action || "status").toLowerCase();
  if (!token) return fail(400, "bad_request", "رمز الجلسة مطلوب");
  if (!appId) return fail(400, "bad_request", "معرّف التطبيق مطلوب");

  try {
    const session = await introspectEmbeddedToken(token, appId);
    if (!session.ok) {
      return fail(session.status, "session_invalid", session.error);
    }
    // This store's own OAuth token (Easy Mode), for the verified merchant.
    const merchantApi = sallaApiFor(session.data.merchant_id);
    const merchantId = String(session.data.merchant_id);

    switch (action) {
      case "status": {
        const { stored, config, enabled, unreadable } =
          await resolveConfig(merchantId);
        const cartBinding = config
          ? (await loadBindings(merchantId)).cart || null
          : null;
        // Never return the token.
        return Response.json({
          success: true,
          connected: Boolean(config),
          enabled,
          // Sending from the app is possible right now.
          configured: Boolean(config) && enabled,
          storageReady: storageReady(),
          // The cart template chosen from the library, else the typed one.
          cartBinding,
          template: cartBinding?.name || config?.template || null,
          language: cartBinding?.language || config?.language || null,
          params: cartBinding
            ? cartBinding.slots.map((slot) => slot.source)
            : config?.params || [],
          invalidParams: cartBinding ? [] : config?.invalidParams || [],
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
            "تخزين الإعدادات غير مفعّل على الخادم (Upstash Redis و WA_SETTINGS_KEY).",
          );
        }
        const stored = await loadStored(merchantId);
        const { values, fields } = validateSettingsInput(body.settings, {
          hasSavedToken: Boolean(stored?.token),
        });
        if (fields) {
          return fail(422, "validation_failed", "بعض الإعدادات غير صحيحة", {
            fields,
          });
        }
        const check = await checkWithMeta(values, stored);
        if (check.response) return check.response;
        const record = await saveSettings(merchantId, values, {
          stored: stored || {},
          profile: check.profile,
        });
        return Response.json({
          success: true,
          settings: publicSettings(record),
        });
      }

      case "account_save": {
        // Settings page: the account only; the cart template is kept.
        if (!storageReady()) return noStorage();
        const stored = await loadStored(merchantId);
        const { values, fields } = validateAccountInput(body.account, {
          hasSavedToken: Boolean(stored?.token),
        });
        if (fields) {
          return fail(422, "validation_failed", "بعض البيانات غير صحيحة", {
            fields,
          });
        }
        const check = await checkWithMeta(values, stored);
        if (check.response) return check.response;
        const record = await saveAccount(merchantId, values, {
          stored: stored || {},
          profile: check.profile,
        });
        // Read the templates right away; the account is saved either way.
        const sync = await syncTemplates(
          merchantId,
          { token: check.token, version: graphVersion() },
          values.wabaId,
        );
        return Response.json({
          success: true,
          settings: publicSettings(record),
          templates: sync.snapshot || null,
          templatesError: sync.error || null,
        });
      }

      case "signup_config": {
        // Public values only: the app secret never leaves the server.
        const signup = signupConfig();
        return Response.json({
          success: true,
          available: Boolean(signup) && storageReady(),
          appId: signup?.appId || null,
          configId: signup?.configId || null,
          version: graphVersion(),
        });
      }

      case "signup_complete":
        return completeSignup(merchantId, body);

      case "templates_sync": {
        const { config, stored, unreadable } = await resolveConfig(merchantId);
        if (!config) return notConnected(unreadable);
        if (!stored.wabaId) {
          return fail(
            422,
            "no_waba",
            "أضف معرّف حساب واتساب للأعمال (WABA ID) في الإعدادات لعرض قوالبك.",
          );
        }
        const sync = await syncTemplates(merchantId, config, stored.wabaId);
        if (sync.error) {
          return fail(sync.status || 422, "meta_error", sync.error, {
            metaCode: sync.metaCode,
            detail: sync.detail,
          });
        }
        return Response.json({ success: true, ...sync.snapshot });
      }

      case "templates_list": {
        const snapshot = storageReady()
          ? await loadTemplates(merchantId)
          : null;
        return Response.json({
          success: true,
          syncedAt: snapshot?.syncedAt || null,
          templates: snapshot?.templates || [],
        });
      }

      case "binding_get": {
        const bindings = storageReady() ? await loadBindings(merchantId) : {};
        return Response.json({ success: true, bindings });
      }

      case "binding_save": {
        // A feature picks a template from the library; checked here against
        // the library itself, never trusting the browser's template details.
        if (!storageReady()) return noStorage();
        const feature = String(body.feature || "");
        if (!SAVED_BINDING_FEATURES.has(feature)) {
          return fail(400, "bad_request", "ميزة غير معروفة");
        }
        if (body.binding === null) {
          const bindings = await saveBinding(merchantId, feature, null);
          return Response.json({ success: true, binding: null, bindings });
        }
        const snapshot = await loadTemplates(merchantId);
        const resolved = resolveBinding(
          body.binding,
          snapshot?.templates,
          BINDING_SOURCES[feature],
        );
        if (resolved.error) {
          return fail(422, "validation_failed", resolved.error);
        }
        const bindings = await saveBinding(
          merchantId,
          feature,
          resolved.binding,
        );
        return Response.json({
          success: true,
          binding: resolved.binding,
          bindings,
        });
      }

      case "settings_enable": {
        const { stored } = await resolveConfig(merchantId);
        if (!stored) return notConnected(false);
        const record = await setEnabled(
          merchantId,
          stored,
          body.enabled === true,
        );
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
        // Works while switched off too, so the merchant can check the setup.
        const { config, unreadable } = await resolveConfig(merchantId);
        if (!config) return notConnected(unreadable);
        const to = whatsappNumber(body.to);
        if (!to) {
          return fail(
            422,
            "bad_number",
            "أدخل رقمًا دوليًا كاملًا، مثل +966500000000.",
          );
        }
        const cartBinding = (await loadBindings(merchantId)).cart;
        if (cartBinding) {
          return deliverBound(
            config,
            cartBinding,
            to,
            cartMessageValues(SAMPLE_CART, {
              locale: bindingLocale(cartBinding),
              couponCode: "SAVE10",
            }),
          );
        }
        return deliver(
          config,
          to,
          cartMessageValues(SAMPLE_CART, { locale: localeOf(config) }),
        );
      }

      case "send": {
        const { config, enabled, unreadable } = await resolveConfig(merchantId);
        if (!config) return notConnected(unreadable);
        if (!enabled) {
          return fail(
            403,
            "whatsapp_disabled",
            "الإرسال من التطبيق متوقف. فعّله من صفحة السلات المتروكة أو أرسل التذكير يدويًا.",
          );
        }
        const cartId = String(body.cartId || "");
        if (!/^\d+$/.test(cartId)) {
          return fail(400, "bad_request", "معرّف السلة مطلوب (أرقام فقط)");
        }
        const { status, body: result } = await merchantApi(
          `/carts/abandoned/${encodeURIComponent(cartId)}`,
        );
        if (!result.success) {
          return fail(
            status >= 400 ? status : 502,
            "salla_api_error",
            result.error?.message || "تعذّر تحميل السلة",
          );
        }
        const cart = result.data || {};
        if (cart.status === "purchased") {
          return fail(409, "cart_purchased", "أكمل العميل هذا الطلب بالفعل.");
        }
        const to = whatsappNumber(cart.customer?.mobile);
        if (!to) {
          return fail(
            422,
            "no_phone",
            "لا يوجد رقم جوال دولي لهذا العميل في سلة.",
          );
        }
        // "text": the merchant's own message, delivered only if the customer
        // wrote to the store in the last 24 hours. The number still comes
        // from Salla's cart, never from the browser.
        if (body.mode === "text") return deliverText(config, to, body.text);
        const cartBinding = (await loadBindings(merchantId)).cart;
        if (cartBinding) {
          return deliverBound(
            config,
            cartBinding,
            to,
            cartMessageValues(cart, {
              locale: bindingLocale(cartBinding),
              couponCode: couponOf(body),
            }),
          );
        }
        if (!config.template) {
          return fail(
            422,
            "no_template",
            "اختر قالب تذكير السلة من «قالب التذكير» في صفحة السلات المتروكة أولًا.",
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

      case "send_campaign": {
        const { config, enabled, unreadable } = await resolveConfig(merchantId);
        if (!config) return notConnected(unreadable);
        if (!enabled) {
          return fail(
            403,
            "whatsapp_disabled",
            "الإرسال من التطبيق متوقف. فعّله من صفحة السلات المتروكة.",
          );
        }
        const to = whatsappNumber(body.to);
        if (body.binding) {
          const snapshot = await loadTemplates(merchantId);
          const resolved = resolveBinding(
            body.binding,
            snapshot?.templates,
            BINDING_SOURCES.campaign,
          );
          if (resolved.error) {
            return fail(422, "validation_failed", resolved.error);
          }
          if (!to) {
            return fail(
              422,
              "bad_number",
              "لا يوجد رقم جوال دولي لهذا العميل.",
            );
          }
          const locale = bindingLocale(resolved.binding);
          const first = String(body.customerName || "")
            .trim()
            .split(/\s+/)[0];
          return deliverBound(config, resolved.binding, to, {
            customer_name: cleanParam(first || FALLBACK_NAME[locale], 60),
            coupon_code: couponOf(body),
          });
        }
        const campaign = campaignConfig(config, body);
        if (campaign.error) {
          return fail(422, "validation_failed", campaign.error);
        }
        if (!to) {
          return fail(422, "bad_number", "لا يوجد رقم جوال دولي لهذا العميل.");
        }
        return deliver(campaign.config, to, campaign.values(body.customerName));
      }

      default:
        return fail(400, "bad_request", `إجراء غير معروف: "${action}"`);
    }
  } catch (error) {
    console.error("WhatsApp endpoint failed:", error.code || error.message);
    return fail(
      error.status || ERROR_STATUS[error.code] || 500,
      error.code || "server_error",
      error.message || "حدث خطأ في الخادم",
    );
  }
}
