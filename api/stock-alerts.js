/**
 * Vercel Serverless Function - the merchant's stock alerts (Alerts tab).
 *
 * Actions (all need a valid embedded session token):
 * - overview      alert settings, recent order alerts, unread count, setup
 * - stock         products out of stock / at or under the threshold, from
 *                 GET /admin/v2/products (scope products.read)
 * - settings_save { threshold } (one of THRESHOLD_OPTIONS)
 * - mark_read     everything up to now counts as read
 * - clear         delete the order alerts
 *
 * Order alerts are written by api/salla-webhook.js (order.created).
 * Env: Upstash (KV_REST_API_URL / KV_REST_API_TOKEN), SALLA_WEBHOOK_SECRET.
 */

import { introspectEmbeddedToken } from "./_lib/salla.js";
import { kvConfigured } from "./_lib/kv.js";
import {
  clearAlerts,
  lastOrder,
  lastReadAt,
  listAlerts,
  loadAlertSettings,
  markRead,
  saveAlertSettings,
  scanStock,
} from "./_lib/stockAlerts.js";
import {
  DEFAULT_THRESHOLD,
  isThreshold,
} from "../src/utils/alerts/stockModel.js";

const ERROR_STATUS = {
  token_not_configured: 500,
  token_expired: 401,
  missing_scope: 403,
};

const fail = (status, code, error, extra = {}) =>
  Response.json({ success: false, status, code, error, ...extra }, { status });

const noStorage = () =>
  fail(
    503,
    "storage_not_configured",
    "تخزين التنبيهات غير مفعّل على الخادم (Upstash Redis).",
  );

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "تعذّر قراءة الطلب");
  }
  const { token } = body;
  const appId = process.env.SALLA_APP_ID || body.appId;
  const action = String(body.action || "overview").toLowerCase();
  if (!token) return fail(400, "bad_request", "رمز الجلسة مطلوب");
  if (!appId) return fail(400, "bad_request", "معرّف التطبيق مطلوب");

  try {
    const session = await introspectEmbeddedToken(token, appId);
    if (!session.ok) {
      return fail(session.status, "session_invalid", session.error);
    }
    const merchantId = String(session.data.merchant_id);
    const storage = kvConfigured();

    switch (action) {
      case "overview": {
        const setup = {
          storage,
          webhookSecret: Boolean(process.env.SALLA_WEBHOOK_SECRET),
        };
        if (!storage) {
          return Response.json({
            success: true,
            setup,
            settings: { threshold: DEFAULT_THRESHOLD },
            alerts: [],
            unread: 0,
            lastOrder: null,
          });
        }
        const [settings, alerts, readAt, order] = await Promise.all([
          loadAlertSettings(merchantId),
          listAlerts(merchantId),
          lastReadAt(merchantId),
          lastOrder(merchantId),
        ]);
        const readMs = Date.parse(readAt || "") || 0;
        return Response.json({
          success: true,
          setup,
          settings,
          alerts: alerts.map((alert) => ({
            ...alert,
            unread: Date.parse(alert.at) > readMs,
          })),
          unread: alerts.filter((alert) => Date.parse(alert.at) > readMs)
            .length,
          lastOrder: order,
        });
      }

      case "stock": {
        const { threshold } = storage
          ? await loadAlertSettings(merchantId)
          : { threshold: DEFAULT_THRESHOLD };
        const result = await scanStock(threshold);
        if (result.error) {
          return fail(
            result.status >= 400 ? result.status : 502,
            "salla_api_error",
            result.error,
          );
        }
        return Response.json({ success: true, threshold, ...result });
      }

      case "settings_save": {
        if (!storage) return noStorage();
        const threshold = Number(body.threshold);
        if (!isThreshold(threshold)) {
          return fail(422, "validation_failed", "اختر حدًا من القائمة");
        }
        const settings = await saveAlertSettings(merchantId, threshold);
        return Response.json({ success: true, settings });
      }

      case "mark_read": {
        if (!storage) return noStorage();
        return Response.json({
          success: true,
          readAt: await markRead(merchantId),
        });
      }

      case "clear": {
        if (!storage) return noStorage();
        await clearAlerts(merchantId);
        return Response.json({ success: true });
      }

      default:
        return fail(400, "bad_request", `إجراء غير معروف: "${action}"`);
    }
  } catch (error) {
    console.error("Stock alerts endpoint failed:", error.code || error.message);
    return fail(
      error.status || ERROR_STATUS[error.code] || 500,
      error.code || "server_error",
      error.message || "حدث خطأ في الخادم",
    );
  }
}
