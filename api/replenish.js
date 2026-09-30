/**
 * Vercel Serverless Function - smart replenishment reminders (WhatsApp).
 *
 * GET  Vercel Cron (vercel.json "crons", once a day). Vercel sends
 *      `Authorization: Bearer <CRON_SECRET>`; without CRON_SECRET nothing runs.
 * POST the embedded app (valid embedded session token required):
 *      - get          settings, cycles, reminders, what's missing
 *      - settings_save switching on needs the merchant's confirmation that
 *                     customers opted in, a connected WhatsApp account and
 *                     CRON_SECRET
 *      - cycle_set    { productId, days (1-365) | null, name }
 *      - send_now     { reminderId } send one scheduled reminder now
 *      - cancel       { reminderId }
 *      - send_test    { to } the template with sample values
 *
 * Reminders are scheduled by api/salla-webhook.js from order.created (and
 * cancelled on order.cancelled / refunded / deleted). No Merchant API call
 * is made here.
 * The logic is in api/_lib/replenish.js.
 */

import { timingSafeEqual } from "node:crypto";
import { introspectEmbeddedToken } from "./_lib/salla.js";
import { resolveConfig, storageReady } from "./_lib/whatsappSettings.js";
import {
  RUN_BUDGET_MS,
  cancelReminder,
  isCycleDays,
  listCycles,
  listReminders,
  loadSettings,
  publicSettings,
  reminderValues,
  runAll,
  saveSettings,
  sendMessage,
  sendNow,
  sendingBlocker,
  sentToday,
  setCycle,
  templateConfig,
  validateSettings,
} from "./_lib/replenish.js";
import { whatsappNumber } from "../src/utils/cartRecovery/whatsappMessage.js";

export const config = { maxDuration: 60 };

const fail = (status, code, error, extra = {}) =>
  Response.json({ success: false, status, code, error, ...extra }, { status });

const noStorage = () =>
  fail(
    503,
    "storage_not_configured",
    "تخزين الإعدادات غير مفعّل على الخادم (Upstash Redis و WA_SETTINGS_KEY).",
  );

function sameSecret(given, expected) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return fail(503, "cron_not_configured", "CRON_SECRET is not set");
  if (
    !sameSecret(request.headers.get("authorization") || "", `Bearer ${secret}`)
  ) {
    return fail(401, "unauthorized", "Unauthorized");
  }
  if (!storageReady()) return noStorage();
  const summary = await runAll({ deadline: Date.now() + RUN_BUDGET_MS });
  return Response.json({ success: true, ...summary });
}

/** What still stops automatic sending (Arabic), or []. */
async function blockers(merchantId, settings) {
  const out = [];
  if (!process.env.CRON_SECRET) {
    out.push(
      "أضف متغير البيئة CRON_SECRET في Vercel ثم أعد النشر، حتى يعمل التشغيل اليومي.",
    );
  }
  const ready = await sendingBlocker(merchantId, settings);
  if (!ready.config) out.push(ready.error);
  return out;
}

const SAMPLE = {
  customerName: "أحمد",
  productName: "قهوة إثيوبية 250 جرام",
  productUrl: "https://salla.sa/your-store/p123456",
};

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "تعذّر قراءة الطلب");
  }
  const { token } = body;
  const appId = process.env.SALLA_APP_ID || body.appId;
  const action = String(body.action || "get").toLowerCase();
  if (!token) return fail(400, "bad_request", "رمز الجلسة مطلوب");
  if (!appId) return fail(400, "bad_request", "معرّف التطبيق مطلوب");

  try {
    const session = await introspectEmbeddedToken(token, appId);
    if (!session.ok) {
      return fail(session.status, "session_invalid", session.error);
    }
    const merchantId = String(session.data.merchant_id);
    if (!storageReady()) return noStorage();

    switch (action) {
      case "get": {
        const stored = await loadSettings(merchantId);
        const settings = publicSettings(stored);
        const [cycles, reminders, count, missing, whatsapp] = await Promise.all(
          [
            listCycles(merchantId),
            listReminders(merchantId),
            sentToday(merchantId),
            blockers(merchantId, settings),
            resolveConfig(merchantId),
          ],
        );
        return Response.json({
          success: true,
          settings,
          cycles,
          reminders,
          sentToday: count,
          blockers: missing,
          whatsapp: {
            connected: Boolean(whatsapp.config),
            enabled: whatsapp.enabled,
          },
        });
      }

      case "settings_save": {
        const { values, fields } = validateSettings(body.settings);
        if (fields) {
          return fail(422, "validation_failed", "بعض الإعدادات غير صحيحة", {
            fields,
          });
        }
        const stored = await loadSettings(merchantId);
        const consent = body.settings?.consent === true;
        if (values.enabled) {
          if (!stored?.consentAt && !consent) {
            return fail(
              422,
              "consent_required",
              "أكّد أن عملاءك وافقوا على استلام رسائل واتساب من متجرك قبل التفعيل.",
            );
          }
          const missing = await blockers(merchantId, values);
          if (missing.length) {
            return fail(409, "not_ready", missing[0], { blockers: missing });
          }
        }
        const record = await saveSettings(merchantId, values, {
          stored,
          consent,
        });
        return Response.json({
          success: true,
          settings: publicSettings(record),
        });
      }

      case "cycle_set": {
        const productId = String(body.productId || "");
        if (!/^\d+$/.test(productId)) {
          return fail(400, "bad_request", "معرّف المنتج مطلوب (أرقام فقط)");
        }
        const days = body.days === null ? null : Number(body.days);
        if (days !== null && !isCycleDays(days)) {
          return fail(422, "validation_failed", "المدة من 1 إلى 365 يومًا");
        }
        const cycle = await setCycle(merchantId, productId, days, body.name);
        return Response.json({ success: true, cycle });
      }

      case "send_now": {
        const result = await sendNow(merchantId, String(body.reminderId || ""));
        if (!result.ok) {
          return fail(422, result.code || "send_failed", result.error, {
            metaCode: result.metaCode ?? null,
          });
        }
        return Response.json({ success: true, messageId: result.messageId });
      }

      case "cancel": {
        const reminder = await cancelReminder(
          merchantId,
          String(body.reminderId || ""),
        );
        if (!reminder) {
          return fail(404, "not_found", "هذا التذكير لم يعد مجدولًا.");
        }
        return Response.json({ success: true });
      }

      case "send_test": {
        // Works while automatic sending is off, to check the template.
        const settings = publicSettings(await loadSettings(merchantId));
        const ready = await sendingBlocker(merchantId, settings);
        if (!ready.config) return fail(422, ready.code, ready.error);
        const to = whatsappNumber(body.to);
        if (!to) {
          return fail(
            422,
            "bad_number",
            "أدخل رقمًا دوليًا كاملًا، مثل +966500000000.",
          );
        }
        const values = reminderValues(SAMPLE, {
          ...settings,
          couponCode: settings.couponCode || "LOYAL10",
        });
        const result = await sendMessage(
          templateConfig(ready.config, settings),
          to,
          values,
        );
        if (!result.ok) {
          return fail(422, "meta_error", result.error, {
            metaCode: result.metaCode ?? null,
          });
        }
        return Response.json({ success: true, messageId: result.messageId });
      }

      default:
        return fail(400, "bad_request", `إجراء غير معروف: "${action}"`);
    }
  } catch (error) {
    console.error("Replenish endpoint failed:", error.code || error.message);
    return fail(
      error.status || 500,
      error.code || "server_error",
      error.message || "حدث خطأ في الخادم",
    );
  }
}
