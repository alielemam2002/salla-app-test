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
import {
  cancelBuildJob,
  completeBuildJob,
  createBuildJob,
  dispatchBuild,
  generatePackageName,
  getBuildRecord,
  getMerchantBuilds,
  getMobileAppConfig,
  saveMobileAppConfig,
  validateStoreUrl,
} from "./_lib/mobileApp.js";

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

const SUPPORTED_ACTIONS = [
  "info",
  "mobile_app_get",
  "mobile_app_save",
  "mobile_app_build",
  "mobile_app_status",
  "mobile_app_cancel",
  "mobile_app_complete",
];

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "bad_request", "تعذّر قراءة الطلب");
  }

  const action = String(body.action || "info");
  if (!SUPPORTED_ACTIONS.includes(action)) {
    return fail(400, "bad_request", `إجراء غير معروف: "${action}"`);
  }

  // Webhook completion callback from build worker can be authenticated with worker secret
  if (action === "mobile_app_complete") {
    const workerSecret = process.env.BUILD_WORKER_SECRET;
    if (workerSecret && body.secret !== workerSecret) {
      return fail(401, "unauthorized", "رمز التحقق من خادم البناء غير صحيح");
    }
    if (!body.buildId) {
      return fail(400, "bad_request", "معرّف البناء buildId مطلوب");
    }
    const updated = await completeBuildJob(body.buildId, {
      success: Boolean(body.success),
      apkUrl: body.apkUrl || null,
      aabUrl: body.aabUrl || null,
      errorMessage: body.errorMessage || null,
    });
    return Response.json({ success: true, build: updated });
  }

  const { token } = body;
  const appId = process.env.SALLA_APP_ID || body.appId;
  if (!token) return fail(400, "bad_request", "رمز الجلسة مطلوب");
  if (!appId) return fail(400, "bad_request", "معرّف التطبيق مطلوب");

  try {
    const session = await introspectEmbeddedToken(token, appId);
    if (!session.ok) {
      return fail(session.status, "session_invalid", session.error);
    }
    const merchantId = String(session.data.merchant_id);

    // ==========================================
    // ACTION: info (Standard Salla store info)
    // ==========================================
    if (action === "info") {
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
    }

    // ==========================================
    // ACTION: mobile_app_get (Get Mobile App Config & Build status)
    // ==========================================
    if (action === "mobile_app_get") {
      let config = await getMobileAppConfig(merchantId);

      // Prepopulate from Salla store info if not yet configured
      if (!config || !config.storeUrl) {
        try {
          const api = sallaApiFor(merchantId);
          const storeRes = await api("/store/info");
          if (storeRes.body?.success && storeRes.body.data) {
            const data = storeRes.body.data;
            const domain = data.domain || `${data.username || "store"}.salla.sa`;
            config = {
              appName: data.name || "متجري",
              storeUrl: `https://${domain}`,
              logoUrl: data.avatar || null,
              primaryColor: "#10B981",
              packageName: generatePackageName(merchantId, data.name),
              status: "DRAFT",
              ...config,
            };
          }
        } catch {
          // Fallback defaults
          config = {
            appName: "متجر سلة",
            storeUrl: "https://salla.sa",
            primaryColor: "#10B981",
            packageName: generatePackageName(merchantId, "store"),
            status: "DRAFT",
            ...config,
          };
        }
      }

      let latestBuild = config?.currentBuildId
        ? await getBuildRecord(config.currentBuildId)
        : config?.latestBuild || null;

      const builds = await getMerchantBuilds(merchantId);

      return Response.json({
        success: true,
        merchantId,
        config,
        latestBuild,
        builds,
      });
    }

    // ==========================================
    // ACTION: mobile_app_save (Save configuration)
    // ==========================================
    if (action === "mobile_app_save") {
      const input = body.config || {};
      if (!input.appName || typeof input.appName !== "string") {
        return fail(422, "validation_failed", "اسم التطبيق مطلوب");
      }

      const urlCheck = validateStoreUrl(input.storeUrl);
      if (!urlCheck.valid) {
        return fail(422, "validation_failed", urlCheck.error);
      }

      const packageName =
        input.packageName || generatePackageName(merchantId, input.appName);

      const saved = await saveMobileAppConfig(merchantId, {
        appName: input.appName.trim(),
        storeUrl: urlCheck.sanitizedUrl,
        primaryColor: input.primaryColor || "#10B981",
        logoUrl: input.logoUrl || null,
        splashUrl: input.splashUrl || null,
        packageName,
        status: "READY",
      });

      return Response.json({ success: true, config: saved });
    }

    // ==========================================
    // ACTION: mobile_app_build (Trigger Android Build)
    // ==========================================
    if (action === "mobile_app_build") {
      let config = await getMobileAppConfig(merchantId);
      if (!config || !config.storeUrl || !config.appName) {
        return fail(
          400,
          "config_missing",
          "يرجى حفظ إعدادات التطبيق قبل بدء البناء",
        );
      }

      const urlCheck = validateStoreUrl(config.storeUrl);
      if (!urlCheck.valid) {
        return fail(422, "validation_failed", urlCheck.error);
      }

      const buildJob = await createBuildJob(merchantId, config);

      // Trigger builder asynchronously
      await dispatchBuild(buildJob);

      return Response.json(
        { success: true, build: buildJob, status: "QUEUED" },
        { status: 202 },
      );
    }

    // ==========================================
    // ACTION: mobile_app_status (Check build status)
    // ==========================================
    if (action === "mobile_app_status") {
      const buildId = body.buildId;
      if (!buildId) {
        const config = await getMobileAppConfig(merchantId);
        return Response.json({
          success: true,
          status: config?.status || "DRAFT",
          latestBuild: config?.latestBuild || null,
        });
      }

      const record = await getBuildRecord(buildId);
      if (!record || record.merchantId !== merchantId) {
        return fail(404, "not_found", "لم يتم العثور على سجل البناء المطلوب");
      }

      return Response.json({ success: true, build: record });
    }

    // ==========================================
    // ACTION: mobile_app_cancel (Cancel active build)
    // ==========================================
    if (action === "mobile_app_cancel") {
      const cancelled = await cancelBuildJob(merchantId);
      return Response.json({
        success: true,
        cancelled,
        message: "تم إلغاء عملية البناء",
      });
    }

    return fail(400, "bad_request", "إجراء غير معروف");
  } catch (error) {
    console.error("Store/MobileApp endpoint failed:", error.code || error.message);
    return fail(
      error.status || 500,
      error.code || "server_error",
      error.message || "حدث خطأ في الخادم",
    );
  }
}

