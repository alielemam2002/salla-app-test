/**
 * Mobile App Generator backend helper for multi-tenant storage,
 * package name validation, URL security, and build dispatching.
 */

import { kvGetJson, kvSetJson } from "./kv.js";

const DEFAULT_PRIMARY_COLOR = "#10B981";

// Android package naming rules validation
export function isValidPackageName(pkg) {
  if (!pkg || typeof pkg !== "string") return false;
  // Standard Android package name regex: e.g. com.example.app_1
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(pkg);
}

// Generate deterministic, unique package name per Salla merchant
export function generatePackageName(merchantId, appName = "") {
  const cleanId = String(merchantId).replace(/[^0-9]/g, "");
  let slug = String(appName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 16);

  if (!slug || !/^[a-z]/.test(slug)) {
    slug = "store";
  }

  const pkg = `sa.salla.app.${slug}_${cleanId}`;
  return isValidPackageName(pkg) ? pkg : `sa.salla.app.m_${cleanId}`;
}

// Strict URL security validation (prevent SSRF, localhost, private IPs)
export function validateStoreUrl(urlString, allowedDomain = null) {
  if (!urlString || typeof urlString !== "string") {
    return { valid: false, error: "رابط المتجر مطلوب" };
  }

  let parsed;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return { valid: false, error: "صيغة الرابط غير صحيحة" };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, error: "يجب أن يبدأ رابط المتجر بـ https://" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block loopback, localhost, and internal/private IP addresses
  const blockedPatterns = [
    /^localhost$/,
    /^127\./,
    /^0\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^169\.254\./,
    /\.local$/,
    /\.internal$/,
  ];

  if (blockedPatterns.some((pattern) => pattern.test(hostname))) {
    return { valid: false, error: "غير مسموح باستخدام عناوين محلية أو داخلية" };
  }

  // If a verified store domain is provided from Salla store info, ensure matching
  if (allowedDomain) {
    const cleanAllowed = allowedDomain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!hostname.includes(cleanAllowed) && !cleanAllowed.includes(hostname)) {
      // Allow salla.sa subdomains as well
      if (!hostname.endsWith(".salla.sa") && !hostname.endsWith(".salla.store")) {
        return {
          valid: false,
          error: `يجب أن يكون الرابط تابعاً لنطاق متجرك المسجل في سلة (${cleanAllowed})`,
        };
      }
    }
  }

  return { valid: true, sanitizedUrl: parsed.toString() };
}

// Storage keys
const configKey = (merchantId) => `mobile_app:${merchantId}`;
const buildKey = (buildId) => `mobile_app_build:${buildId}`;
const merchantBuildsKey = (merchantId) => `mobile_app_builds:${merchantId}`;

export async function getMobileAppConfig(merchantId) {
  return await kvGetJson(configKey(merchantId));
}

export async function saveMobileAppConfig(merchantId, data) {
  const current = (await getMobileAppConfig(merchantId)) || {};
  const updated = {
    ...current,
    ...data,
    merchantId: String(merchantId),
    updatedAt: Date.now(),
    createdAt: current.createdAt || Date.now(),
  };
  await kvSetJson(configKey(merchantId), updated);
  return updated;
}

export async function getBuildRecord(buildId) {
  return await kvGetJson(buildKey(buildId));
}

export async function saveBuildRecord(buildId, record) {
  await kvSetJson(buildKey(buildId), record);
}

export async function getMerchantBuilds(merchantId) {
  const ids = (await kvGetJson(merchantBuildsKey(merchantId))) || [];
  const builds = [];
  for (const id of ids.slice(-10)) {
    const b = await getBuildRecord(id);
    if (b) builds.push(b);
  }
  return builds.reverse();
}

export async function createBuildJob(merchantId, appConfig) {
  const merchantStr = String(merchantId);
  const current = await getMobileAppConfig(merchantStr);

  // Check if a build is already in progress
  if (current?.status === "BUILDING" && current?.currentBuildId) {
    const active = await getBuildRecord(current.currentBuildId);
    if (active && (active.status === "QUEUED" || active.status === "PROCESSING")) {
      const durationMs = Date.now() - (active.startedAt || 0);
      // Timeout after 15 minutes if stuck
      if (durationMs < 15 * 60 * 1000) {
        const error = new Error("يوجد بناء قيد التنفيذ حالياً لهذا المتجر.");
        error.code = "build_in_progress";
        error.status = 409;
        throw error;
      }
    }
  }

  const buildId = `bld_${merchantStr}_${Date.now()}`;
  const now = Date.now();

  const buildRecord = {
    id: buildId,
    merchantId: merchantStr,
    appName: appConfig.appName,
    storeUrl: appConfig.storeUrl,
    packageName: appConfig.packageName,
    primaryColor: appConfig.primaryColor || DEFAULT_PRIMARY_COLOR,
    logoUrl: appConfig.logoUrl || null,
    platform: "android",
    buildType: "apk_and_aab",
    status: "QUEUED",
    apkUrl: null,
    aabUrl: null,
    errorMessage: null,
    startedAt: now,
    completedAt: null,
    createdAt: now,
  };

  // Save build record
  await saveBuildRecord(buildId, buildRecord);

  // Track build ID in merchant's builds list
  const existingList = (await kvGetJson(merchantBuildsKey(merchantStr))) || [];
  existingList.push(buildId);
  await kvSetJson(merchantBuildsKey(merchantStr), existingList);

  // Update app status to BUILDING
  await saveMobileAppConfig(merchantStr, {
    status: "BUILDING",
    currentBuildId: buildId,
  });

  return buildRecord;
}

export async function completeBuildJob(buildId, { success, apkUrl, aabUrl, errorMessage }) {
  const build = await getBuildRecord(buildId);
  if (!build) return null;

  const now = Date.now();
  const updatedBuild = {
    ...build,
    status: success ? "SUCCESS" : "FAILED",
    apkUrl: success ? apkUrl : null,
    aabUrl: success ? aabUrl : null,
    errorMessage: success ? null : (errorMessage || "فشل بناء التطبيق"),
    completedAt: now,
  };

  await saveBuildRecord(buildId, updatedBuild);

  // Update mobile app record
  await saveMobileAppConfig(build.merchantId, {
    status: success ? "COMPLETED" : "FAILED",
    currentBuildId: null,
    latestBuild: updatedBuild,
  });

  return updatedBuild;
}

export async function cancelBuildJob(merchantId) {
  const config = await getMobileAppConfig(merchantId);
  if (!config?.currentBuildId) return false;

  const build = await getBuildRecord(config.currentBuildId);
  if (build) {
    await saveBuildRecord(config.currentBuildId, {
      ...build,
      status: "CANCELLED",
      completedAt: Date.now(),
      errorMessage: "تم إلغاء عملية البناء بواسطة التاجر",
    });
  }

  await saveMobileAppConfig(merchantId, {
    status: "DRAFT",
    currentBuildId: null,
  });

  return true;
}

export async function dispatchBuild(buildRecord, callbackUrl = null) {
  const githubToken = process.env.GITHUB_BUILD_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;

  if (githubToken && githubRepo) {
    try {
      const res = await fetch(`https://api.github.com/repos/${githubRepo}/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "Salla-Mobile-App-Generator",
        },
        body: JSON.stringify({
          event_type: "build-mobile-app",
          client_payload: {
            build_id: buildRecord.id,
            merchant_id: buildRecord.merchantId,
            app_name: buildRecord.appName,
            store_url: buildRecord.storeUrl,
            package_name: buildRecord.packageName,
            primary_color: buildRecord.primaryColor,
            logo_url: buildRecord.logoUrl,
            callback_url: callbackUrl,
          },
        }),
      });

      if (!res.ok) {
        console.error("Failed to trigger GitHub Actions build:", await res.text());
      }
    } catch (err) {
      console.error("Error dispatching build to GitHub:", err);
    }
  }
}

