/**
 * Vercel Serverless Function - Storewide coupons (Salla Merchant API)
 *
 * Handles (docs: https://docs.salla.dev/841818f0.md):
 * - list:   GET    /admin/v2/coupons?page=&keyword=     (scope marketing.read)
 * - get:    GET    /admin/v2/coupons/{id}               (scope marketing.read)
 * - create: POST   /admin/v2/coupons                    (scope marketing.read_write)
 * - update: PUT    /admin/v2/coupons/{id}               (scope marketing.read_write)
 * - delete: DELETE /admin/v2/coupons/{id}               (scope marketing.read_write)
 *
 * Coupons created or edited here are always storewide: the payload is built
 * from an allow-list and never includes product/category/brand/customer-group
 * include/exclude lists or payment-method restrictions.
 *
 * Authentication:
 * 1. Verifies the embedded session token via Salla introspect
 * 2. Uses the store's OAuth access token from SALLA_ACCESS_TOKEN
 */

import { introspectEmbeddedToken, merchantApi } from "./_lib/salla.js";

const ERROR_STATUS = {
  token_not_configured: 500,
  token_expired: 401,
  missing_scope: 403,
};

const fail = (status, code, error, fields = null) =>
  Response.json(
    { success: false, status, code, error, ...(fields ? { fields } : {}) },
    { status },
  );

/** Pass Salla's own status, message and field errors through unchanged. */
const sallaFail = (status, result, fallback) =>
  fail(
    status >= 400 ? status : 502,
    "salla_api_error",
    result?.error?.message || fallback,
    result?.error?.fields || null,
  );

const DATE_RE = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/;

const toNumber = (value) =>
  value === undefined || value === null || value === ""
    ? undefined
    : Number(value);

/**
 * Build the Salla request body from the client's coupon input.
 * Returns { payload } or { fields } with validation messages.
 */
export function buildCouponPayload(input) {
  const fields = {};
  const code = String(input?.code || "").trim();
  const type = String(input?.type || "").toLowerCase();
  const amount = toNumber(input?.amount);
  const maximumAmount = toNumber(input?.maximum_amount);
  const minimumAmount = toNumber(input?.minimum_amount);
  const usageLimit = toNumber(input?.usage_limit);
  const usageLimitPerUser = toNumber(input?.usage_limit_per_user);
  const startDate = String(input?.start_date || "").trim();
  const expiryDate = String(input?.expiry_date || "").trim();

  if (!code) fields.code = ["كود الكوبون مطلوب"];
  else if (/\s/.test(code))
    fields.code = ["كود الكوبون لا يجوز أن يحتوي على مسافات"];

  if (type !== "percentage" && type !== "fixed") {
    fields.type = ["نوع الخصم يجب أن يكون نسبة مئوية أو مبلغًا ثابتًا"];
  }
  if (amount === undefined || !Number.isFinite(amount) || amount <= 0) {
    fields.amount = ["قيمة الخصم يجب أن تكون أكبر من 0"];
  } else if (type === "percentage" && amount > 100) {
    fields.amount = ["النسبة المئوية لا يمكن أن تتجاوز 100"];
  }
  // Salla: maximum_amount is required when type is percentage.
  if (
    type === "percentage" &&
    (maximumAmount === undefined ||
      !Number.isFinite(maximumAmount) ||
      maximumAmount <= 0)
  ) {
    fields.maximum_amount = [
      "الحد الأقصى للخصم مطلوب في الكوبونات ذات النسبة المئوية",
    ];
  }
  if (!expiryDate) fields.expiry_date = ["تاريخ الانتهاء مطلوب"];
  else if (!DATE_RE.test(expiryDate))
    fields.expiry_date = ["تاريخ الانتهاء غير صحيح"];
  if (startDate && !DATE_RE.test(startDate)) {
    fields.start_date = ["تاريخ البداية غير صحيح"];
  }
  for (const [key, value] of [
    ["minimum_amount", minimumAmount],
    ["usage_limit", usageLimit],
    ["usage_limit_per_user", usageLimitPerUser],
  ]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      fields[key] = ["يجب أن يكون رقمًا موجبًا"];
    }
  }

  if (Object.keys(fields).length) return { fields };

  const payload = {
    code,
    type,
    amount,
    free_shipping: Boolean(input.free_shipping),
    exclude_sale_products: Boolean(input.exclude_sale_products),
    expiry_date: expiryDate,
    applied_in: "all",
  };
  if (type === "percentage") payload.maximum_amount = maximumAmount;
  if (startDate) payload.start_date = startDate;
  if (minimumAmount !== undefined) payload.minimum_amount = minimumAmount;
  if (usageLimit !== undefined) payload.usage_limit = usageLimit;
  if (usageLimitPerUser !== undefined) {
    payload.usage_limit_per_user = usageLimitPerUser;
  }
  if (input.status === "active" || input.status === "inactive") {
    payload.status = input.status;
  }
  return { payload };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "بيانات الطلب غير صالحة");
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

    const couponPath = () =>
      `/coupons/${encodeURIComponent(String(body.couponId))}`;

    switch (action) {
      case "list": {
        const params = new URLSearchParams({
          page: String(Math.max(1, parseInt(body.page, 10) || 1)),
        });
        const keyword =
          typeof body.keyword === "string" ? body.keyword.trim() : "";
        if (keyword) params.set("keyword", keyword);

        const { status, body: result } = await merchantApi(
          `/coupons?${params.toString()}`,
        );
        if (!result.success) {
          return sallaFail(
            status,
            result,
            `Failed to load coupons (status ${status})`,
          );
        }
        return Response.json({
          success: true,
          coupons: result.data || [],
          pagination: result.pagination || null,
        });
      }

      case "get": {
        if (!body.couponId)
          return fail(400, "bad_request", "معرّف الكوبون مطلوب");
        const { status, body: result } = await merchantApi(couponPath());
        if (!result.success) {
          return sallaFail(
            status,
            result,
            `Failed to load coupon (status ${status})`,
          );
        }
        return Response.json({ success: true, coupon: result.data });
      }

      case "create":
      case "update": {
        if (action === "update" && !body.couponId) {
          return fail(400, "bad_request", "معرّف الكوبون مطلوب");
        }
        const { payload, fields } = buildCouponPayload(body.coupon);
        if (fields) {
          return fail(
            422,
            "validation_failed",
            "بعض حقول الكوبون غير صحيحة",
            fields,
          );
        }
        const { status, body: result } = await merchantApi(
          action === "create" ? "/coupons" : couponPath(),
          { method: action === "create" ? "POST" : "PUT", body: payload },
        );
        if (!result.success) {
          return sallaFail(
            status,
            result,
            `Failed to ${action} coupon (status ${status})`,
          );
        }
        return Response.json(
          { success: true, coupon: result.data },
          { status: action === "create" ? 201 : 200 },
        );
      }

      case "delete": {
        if (!body.couponId)
          return fail(400, "bad_request", "معرّف الكوبون مطلوب");
        const { status, body: result } = await merchantApi(couponPath(), {
          method: "DELETE",
        });
        if (!result.success) {
          return sallaFail(
            status,
            result,
            `Failed to delete coupon (status ${status})`,
          );
        }
        return Response.json({
          success: true,
          couponId: body.couponId,
          message: result.data?.message || "تم حذف الكوبون",
        });
      }

      default:
        return fail(400, "bad_request", `إجراء غير معروف: "${action}"`);
    }
  } catch (error) {
    console.error("Coupons endpoint failed:", error);
    return fail(
      error.status || ERROR_STATUS[error.code] || 500,
      error.code || "server_error",
      error.message || "خطأ داخلي في الخادم",
    );
  }
}
