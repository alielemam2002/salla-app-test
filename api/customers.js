/**
 * Vercel Serverless Function - Store customers for WhatsApp campaigns
 * (read-only, scope customers.read).
 *
 * - list:   GET /admin/v2/customers?page=&fields[]=is_blocked&fields[]=is_notifications_enabled
 *           docs: https://docs.salla.dev/5394121e0.md (cursor pagination: follow `next`)
 * - groups: GET /admin/v2/customers/groups
 *           docs: https://docs.salla.dev/customer-group/list.md
 *
 * Salla limits the customers endpoint to 500 requests per 10 minutes, so
 * the browser loads pages one after another with a page cap.
 *
 * Authentication:
 * 1. Verifies the embedded session token via Salla introspect
 * 2. Uses that store's own OAuth token (Easy Mode, api/_lib/merchantTokens.js)
 */

import { introspectEmbeddedToken, sallaApiFor } from "./_lib/salla.js";

const ERROR_STATUS = {
  store_not_authorized: 403,
  token_expired: 401,
  missing_scope: 403,
};

const fail = (status, code, error) =>
  Response.json({ success: false, status, code, error }, { status });

const sallaFail = (status, result, fallback) =>
  fail(
    status >= 400 ? status : 502,
    "salla_api_error",
    result?.error?.message || fallback,
  );

/**
 * Salla keeps the number without its country code (`mobile`) and the code
 * apart (`mobile_code`, e.g. "+966"). Returns "+<code><number>", or "" when
 * no full international number can be built.
 */
export function customerMobile(mobile, mobileCode) {
  const digits = String(mobile ?? "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");
  const code = String(mobileCode ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (!code) return "";
  // Some stores already save the number with its code.
  if (digits.startsWith(code) && digits.length > 10) return `+${digits}`;
  return `+${code}${digits}`;
}

/** Only what a campaign needs; nothing else leaves the server. */
export function pickCustomer(c) {
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  const mobile = customerMobile(c.mobile, c.mobile_code);
  return {
    id: c.id,
    name,
    firstName: c.first_name || "",
    mobile,
    city: c.city || "",
    groups: Array.isArray(c.groups) ? c.groups : [],
    isBlocked: c.is_blocked === true,
    // undefined when Salla doesn't send it: treated as "not switched off".
    notificationsEnabled: c.is_notifications_enabled,
  };
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
  const action = String(body.action || "list").toLowerCase();
  if (!token) return fail(400, "bad_request", "رمز الجلسة مطلوب");
  if (!appId) return fail(400, "bad_request", "معرّف التطبيق مطلوب");

  try {
    const session = await introspectEmbeddedToken(token, appId);
    if (!session.ok) {
      return fail(session.status, "session_invalid", session.error);
    }
    // This store's own OAuth token (Easy Mode), for the verified merchant.
    const merchantApi = sallaApiFor(session.data.merchant_id);

    switch (action) {
      case "list": {
        const params = new URLSearchParams({
          page: String(Math.max(1, parseInt(body.page, 10) || 1)),
        });
        params.append("fields[]", "is_blocked");
        params.append("fields[]", "is_notifications_enabled");
        const { status, body: result } = await merchantApi(
          `/customers?${params.toString()}`,
        );
        if (!result.success) {
          return sallaFail(
            status,
            result,
            `تعذّر تحميل العملاء (الحالة ${status})`,
          );
        }
        return Response.json({
          success: true,
          customers: (Array.isArray(result.data) ? result.data : []).map(
            pickCustomer,
          ),
          pagination: result.pagination || null,
        });
      }

      case "groups": {
        const { status, body: result } = await merchantApi("/customers/groups");
        if (!result.success) {
          return sallaFail(
            status,
            result,
            `تعذّر تحميل مجموعات العملاء (الحالة ${status})`,
          );
        }
        return Response.json({
          success: true,
          groups: (Array.isArray(result.data) ? result.data : []).map((g) => ({
            id: g.id,
            name: g.name,
          })),
        });
      }

      default:
        return fail(400, "bad_request", `إجراء غير معروف: "${action}"`);
    }
  } catch (error) {
    console.error("Customers endpoint failed:", error.code || error.message);
    return fail(
      error.status || ERROR_STATUS[error.code] || 500,
      error.code || "server_error",
      error.message || "حدث خطأ في الخادم",
    );
  }
}
