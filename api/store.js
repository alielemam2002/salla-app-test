/**
 * Vercel Serverless Function - the merchant's store details (Settings tab).
 *
 * POST { action: "info" } (valid embedded session token required):
 * - access: does the app hold this store's OAuth tokens? (tokenStatus: no
 *   token values, only expiry, offline_access and the granted scopes)
 * - store:  GET /admin/v2/store/info with the store's own token
 *           docs: https://docs.salla.dev/merchants/store-info.md
 * - user:   GET https://accounts.salla.sa/oauth2/user/info (who the token
 *           belongs to, commercial / tax numbers)
 *           docs: https://docs.salla.dev/merchants/user-info.md
 * Each part fails on its own, so one missing scope doesn't hide the rest.
 */

import {
  introspectEmbeddedToken,
  sallaApiFor,
  sallaUserInfo,
} from "./_lib/salla.js";
import { kvConfigured } from "./_lib/kv.js";
import { tokenStatus } from "./_lib/merchantTokens.js";

const fail = (status, code, error) =>
  Response.json({ success: false, status, code, error }, { status });

const pick = (source, keys) =>
  Object.fromEntries(keys.map((key) => [key, source?.[key] ?? null]));

/** Only what the Settings page shows. */
function pickStore(data = {}) {
  const branch = data.default_branch || null;
  return {
    ...pick(data, [
      "id",
      "name",
      "username",
      "entity",
      "email",
      "mobile",
      "phone",
      "avatar",
      "plan",
      "status",
      "verified",
      "currency",
      "domain",
      "about",
      "created_at",
    ]),
    licenses: data.licenses || null,
    social: data.social || null,
    owner: data.owner ? pick(data.owner, ["name", "email", "mobile"]) : null,
    branch: branch
      ? {
          name: branch.name || null,
          city: branch.city?.name || null,
          country: branch.country?.name || null,
          address: [branch.street, branch.address_description]
            .filter(Boolean)
            .join("، "),
          postalCode: branch.postal_code || null,
          phone: branch.contacts?.phone || branch.contacts?.telephone || null,
          whatsapp: branch.contacts?.whatsapp || null,
          codAvailable: branch.is_cod_available ?? null,
        }
      : null,
  };
}

function pickUser(data = {}) {
  return {
    ...pick(data, ["id", "name", "email", "mobile", "role", "created_at"]),
    merchant: data.merchant
      ? pick(data.merchant, [
          "id",
          "username",
          "name",
          "plan",
          "status",
          "domain",
          "tax_number",
          "commercial_number",
          "created_at",
        ])
      : null,
  };
}

const reason = (result) =>
  result.status === "rejected"
    ? result.reason?.message || "تعذّر التحميل"
    : null;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "تعذّر قراءة الطلب");
  }
  const { token } = body;
  const appId = process.env.SALLA_APP_ID || body.appId;
  if (!token) return fail(400, "bad_request", "رمز الجلسة مطلوب");
  if (!appId) return fail(400, "bad_request", "معرّف التطبيق مطلوب");
  if (String(body.action || "info") !== "info") {
    return fail(400, "bad_request", "إجراء غير معروف");
  }

  try {
    const session = await introspectEmbeddedToken(token, appId);
    if (!session.ok) {
      return fail(session.status, "session_invalid", session.error);
    }
    const merchantId = String(session.data.merchant_id);
    const access = kvConfigured()
      ? await tokenStatus(merchantId)
      : { authorized: false, storage: false };
    if (!access.authorized) {
      return Response.json({
        success: true,
        merchantId,
        access,
        store: null,
        user: null,
        errors: {},
      });
    }

    const api = sallaApiFor(merchantId);
    const [storeResult, userResult] = await Promise.allSettled([
      api("/store/info"),
      sallaUserInfo(merchantId),
    ]);
    const storeBody =
      storeResult.status === "fulfilled" ? storeResult.value.body : null;
    const user = userResult.status === "fulfilled" ? userResult.value : null;

    return Response.json({
      success: true,
      merchantId,
      access,
      store: storeBody?.success ? pickStore(storeBody.data) : null,
      user: user?.ok ? pickUser(user.data) : null,
      errors: {
        store:
          reason(storeResult) ||
          (storeBody && !storeBody.success
            ? storeBody.error?.message || "تعذّر تحميل بيانات المتجر"
            : null),
        user: reason(userResult) || (user && !user.ok ? user.error : null),
      },
    });
  } catch (error) {
    console.error("Store endpoint failed:", error.code || error.message);
    return fail(
      error.status || 500,
      error.code || "server_error",
      error.message || "حدث خطأ في الخادم",
    );
  }
}
