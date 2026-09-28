/**
 * Vercel Serverless Function - Performance Center API
 *
 * Handles:
 * - action: "test": Runs real Google PageSpeed Insights (Mobile & Desktop) + Chrome UX Report (CrUX)
 * - action: "store_info": Fetches the authenticated merchant's store URL from Salla API if available
 *
 * Performance & Reliability Optimizations:
 * - In-memory response caching (10 minutes TTL) to prevent redundant slow Google queries.
 * - Supports targeted strategy scanning ("mobile" or "desktop" or "all") for instant, responsive UX.
 * - Server-side & user-provided API key support with clear Quota Exceeded guidance.
 * - Abort timeouts to prevent hanging serverless execution.
 */

import { introspectEmbeddedToken, merchantApi } from "./_lib/salla.js";

const PAGESPEED_API_BASE = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CRUX_API_BASE = "https://chromeuxreport.googleapis.com/v1/records:queryRecord";

// 10 minutes in-memory cache for fast repeated views and zero redundant fetches
const scanCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

function getCached(key) {
  const item = scanCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    scanCache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data) {
  scanCache.set(key, { data, timestamp: Date.now() });
  // Prevent memory growth
  if (scanCache.size > 100) {
    const oldestKey = scanCache.keys().next().value;
    scanCache.delete(oldestKey);
  }
}

/**
 * Validates and extracts safe URL and origin
 */
function parseSafeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { ok: false, error: "Please enter a valid store URL." };
  }

  let trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();

  // Block unsafe protocols
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("file:") ||
    lower.startsWith("vbscript:")
  ) {
    return { ok: false, error: "Unsafe URL protocol detected." };
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "URL must use http:// or https://" };
    }

    const host = parsed.hostname.toLowerCase();
    if (!host || !host.includes(".") || host.length < 3 || host.startsWith(".") || host.endsWith(".")) {
      return { ok: false, error: "Invalid domain name. Example: https://store.example.sa" };
    }

    // Strip hash and trailing slash if root
    parsed.hash = "";
    let normalized = parsed.toString();
    if (parsed.pathname === "/" && !parsed.search) {
      normalized = `${parsed.protocol}//${parsed.host}`;
    }

    return {
      ok: true,
      url: normalized,
      origin: `${parsed.protocol}//${parsed.host}`
    };
  } catch {
    return { ok: false, error: "Malformed store URL." };
  }
}

/**
 * Executes a single PageSpeed Insights request with timeout and error classification
 */
async function fetchPageSpeed(url, strategy, apiKey) {
  const query = new URLSearchParams({
    url,
    strategy,
    category: "PERFORMANCE",
    locale: "ar"
  });

  if (apiKey) {
    query.set("key", apiKey);
  }

  const endpoint = `${PAGESPEED_API_BASE}?${query.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 28000); // 28s timeout

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        ok: false,
        status: res.status,
        error: `PageSpeed returned non-JSON response (${res.status})`
      };
    }

    if (!res.ok) {
      const msg = data.error?.message || `PageSpeed error (${res.status})`;
      const isQuotaExceeded = res.status === 429 || /quota/i.test(msg);
      return {
        ok: false,
        status: res.status,
        code: isQuotaExceeded ? "quota_exceeded" : "pagespeed_error",
        error: isQuotaExceeded
          ? "تم استنفاد الحصة المجانية العامة لـ Google PageSpeed اليوم. يرجى إدخال Google API Key الخاص بك للاستمرار بلا حدود وبسرعة فائقة."
          : msg
      };
    }

    return { ok: true, data };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === "AbortError";
    return {
      ok: false,
      status: isTimeout ? 504 : 500,
      code: isTimeout ? "timeout" : "network_error",
      error: isTimeout
        ? "استغرقت Google وقتاً طويلاً للاستجابة لهذا الفحص. يرجى إعادة المحاولة."
        : err.message || "Failed to connect to PageSpeed API"
    };
  }
}

/**
 * Executes a CrUX API query (with fallback to origin query if URL has insufficient traffic)
 */
async function fetchCrux(url, origin, formFactor, apiKey) {
  if (!apiKey) {
    return { ok: false, reason: "No CrUX API key configured on server." };
  }

  const cruxUrl = `${CRUX_API_BASE}?key=${apiKey}`;

  // 1. Try specific URL first
  try {
    const resUrl = await fetch(cruxUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formFactor: formFactor || "ALL_FORM_FACTORS"
      })
    });

    if (resUrl.ok) {
      const data = await resUrl.json();
      return { ok: true, data };
    }

    // 2. If 404 (RECORD_NOT_FOUND), fallback to origin query
    if (resUrl.status === 404 && origin && origin !== url) {
      const resOrigin = await fetch(cruxUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          formFactor: formFactor || "ALL_FORM_FACTORS"
        })
      });

      if (resOrigin.ok) {
        const data = await resOrigin.json();
        return { ok: true, data, isOriginFallback: true };
      }
    }

    return { ok: false, status: resUrl.status, notFound: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Tries to retrieve store URL from Salla
 */
async function fetchSallaStoreUrl(token, appId) {
  try {
    if (!token || !appId) return null;
    const session = await introspectEmbeddedToken(token, appId);
    if (!session.ok) return null;

    // Check store info or merchant info
    const res = await merchantApi("/oauth2/user/info");
    if (res.status === 200 && res.body?.data) {
      const merchant = res.body.data;
      if (merchant.merchant?.domain) {
        return `https://${merchant.merchant.domain}`;
      }
      if (merchant.merchant?.url) {
        return merchant.merchant.url;
      }
    }

    const storeRes = await merchantApi("/store/info");
    if (storeRes.status === 200 && storeRes.body?.data) {
      const store = storeRes.body.data;
      if (store.domain) return `https://${store.domain}`;
      if (store.url) return store.url;
    }
  } catch {
    // Salla token not available or not configured - return null gracefully
  }
  return null;
}

/**
 * Main Handler (Supports Web Request & Node.js req/res)
 */
async function handleRequest(body) {
  const action = (body.action || "test").toLowerCase();
  const apiKey = (body.apiKey && typeof body.apiKey === "string" && body.apiKey.trim())
    ? body.apiKey.trim()
    : process.env.PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY || "";

  if (action === "store_info") {
    const storeUrl = await fetchSallaStoreUrl(body.token, body.appId || process.env.SALLA_APP_ID);
    return {
      status: 200,
      json: { success: true, url: storeUrl }
    };
  }

  if (action === "test") {
    const parsed = parseSafeUrl(body.url);
    if (!parsed.ok) {
      return {
        status: 400,
        json: { success: false, code: "invalid_url", error: parsed.error }
      };
    }

    const targetUrl = parsed.url;
    const targetOrigin = parsed.origin;
    const requestedStrategy = (body.strategy || "all").toLowerCase(); // "mobile" | "desktop" | "all"
    const forceFresh = Boolean(body.force);

    // Check cache first (unless forced fresh)
    const cacheKey = `${targetUrl.toLowerCase()}::${requestedStrategy}::${apiKey ? 'keyed' : 'anon'}`;
    if (!forceFresh) {
      const cached = getCached(cacheKey);
      if (cached) {
        return {
          status: 200,
          json: { ...cached, isFromCache: true }
        };
      }
    }

    let mobilePsi = { ok: false, data: null };
    let desktopPsi = { ok: false, data: null };
    let cruxMobile = { ok: false, data: null };
    let cruxDesktop = { ok: false, data: null };

    // Progressive Strategy Scanning:
    if (requestedStrategy === "mobile") {
      mobilePsi = await fetchPageSpeed(targetUrl, "mobile", apiKey);
      if (apiKey) cruxMobile = await fetchCrux(targetUrl, targetOrigin, "PHONE", apiKey);
    } else if (requestedStrategy === "desktop") {
      desktopPsi = await fetchPageSpeed(targetUrl, "desktop", apiKey);
      if (apiKey) cruxDesktop = await fetchCrux(targetUrl, targetOrigin, "DESKTOP", apiKey);
    } else {
      // "all": fetch mobile first, then desktop sequentially to avoid Google concurrent 429/timeout
      mobilePsi = await fetchPageSpeed(targetUrl, "mobile", apiKey);

      // Only attempt desktop if mobile didn't fail with global quota limit
      if (mobilePsi.code !== "quota_exceeded") {
        desktopPsi = await fetchPageSpeed(targetUrl, "desktop", apiKey);
      } else {
        desktopPsi = { ok: false, error: mobilePsi.error, code: "quota_exceeded", status: 429 };
      }

      if (apiKey) {
        [cruxMobile, cruxDesktop] = await Promise.all([
          fetchCrux(targetUrl, targetOrigin, "PHONE", apiKey),
          fetchCrux(targetUrl, targetOrigin, "DESKTOP", apiKey)
        ]);
      }
    }

    // If all requested strategies failed
    const hasAnySuccess = (requestedStrategy === "mobile" && mobilePsi.ok) ||
                          (requestedStrategy === "desktop" && desktopPsi.ok) ||
                          (requestedStrategy === "all" && (mobilePsi.ok || desktopPsi.ok));

    if (!hasAnySuccess) {
      const primaryErr = (requestedStrategy === "desktop" ? desktopPsi : mobilePsi) || {};
      const isQuota = primaryErr.code === "quota_exceeded" || primaryErr.status === 429;
      return {
        status: isQuota ? 429 : 502,
        json: {
          success: false,
          code: isQuota ? "quota_exceeded" : (primaryErr.code || "pagespeed_failed"),
          error: primaryErr.error || "فشل فحص سرعة المتجر، يرجى المحاولة لاحقاً."
        }
      };
    }

    const responsePayload = {
      success: true,
      url: targetUrl,
      strategy: requestedStrategy,
      mobile: mobilePsi.ok ? mobilePsi.data : null,
      desktop: desktopPsi.ok ? desktopPsi.data : null,
      cruxMobile: cruxMobile.ok ? cruxMobile.data : null,
      cruxDesktop: cruxDesktop.ok ? cruxDesktop.data : null,
      errors: {
        mobile: !mobilePsi.ok ? mobilePsi.error : null,
        desktop: !desktopPsi.ok ? desktopPsi.error : null
      }
    };

    // Store in cache for 10 minutes
    setCached(cacheKey, responsePayload);

    return {
      status: 200,
      json: responsePayload
    };
  }

  return {
    status: 400,
    json: { success: false, error: `Unknown action: ${action}` }
  };
}

// Export Web API POST (for Vercel Edge / Node runtime with Web standard)
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await handleRequest(body);
  return Response.json(result.json, {
    status: result.status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

// Export Node.js default handler (for Vercel serverless / express style)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const result = await handleRequest(body);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(result.status).json(result.json);
  } catch (error) {
    console.error("Performance API error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error"
    });
  }
}
