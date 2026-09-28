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

  if (!code) fields.code = ["Coupon code is required"];
  else if (/\s/.test(code)) fields.code = ["Coupon code can't contain spaces"];

  if (type !== "percentage" && type !== "fixed") {
    fields.type = ["Discount type must be percentage or fixed"];
  }
  if (amount === undefined || !Number.isFinite(amount) || amount <= 0) {
    fields.amount = ["Discount must be greater than 0"];
  } else if (type === "percentage" && amount > 100) {
    fields.amount = ["A percentage discount can't exceed 100"];
  }
  // Salla: maximum_amount is required when type is percentage.
  if (
    type === "percentage" &&
    (maximumAmount === undefined ||
      !Number.isFinite(maximumAmount) ||
      maximumAmount <= 0)
  ) {
    fields.maximum_amount = [
      "Maximum discount is required for percentage coupons",
    ];
  }
  if (!expiryDate) fields.expiry_date = ["End date is required"];
  else if (!DATE_RE.test(expiryDate)) fields.expiry_date = ["Invalid end date"];
  if (startDate && !DATE_RE.test(startDate)) {
    fields.start_date = ["Invalid start date"];
  }
  for (const [key, value] of [
    ["minimum_amount", minimumAmount],
    ["usage_limit", usageLimit],
    ["usage_limit_per_user", usageLimitPerUser],
  ]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      fields[key] = ["Must be a positive number"];
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
    return fail(400, "bad_request", "Invalid JSON body");
  }

  const { token } = body;
  const appId = process.env.SALLA_APP_ID || body.appId;
  const action = String(body.action || "list").toLowerCase();

  if (!token) return fail(400, "bad_request", "Token is required");
  if (!appId) return fail(400, "bad_request", "App ID is required");

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
          return fail(400, "bad_request", "Coupon ID is required");
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
          return fail(400, "bad_request", "Coupon ID is required");
        }
        const { payload, fields } = buildCouponPayload(body.coupon);
        if (fields) {
          return fail(
            422,
            "validation_failed",
            "Some coupon fields are invalid",
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
          return fail(400, "bad_request", "Coupon ID is required");
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
          message: result.data?.message || "Coupon deleted",
        });
      }

      default:
        return fail(400, "bad_request", `Unknown action: "${action}"`);
    }
  } catch (error) {
    console.error("Coupons endpoint failed:", error);
    return fail(
      error.status || ERROR_STATUS[error.code] || 500,
      error.code || "server_error",
      error.message || "Internal server error",
    );
  }
}
