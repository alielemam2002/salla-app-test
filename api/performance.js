/**
 * Vercel Serverless Function - Performance Center API
 *
 * Handles:
 * - action: "test": Runs real Google PageSpeed Insights (Mobile & Desktop) + Chrome UX Report (CrUX)
 * - action: "store_info": Fetches the authenticated merchant's store URL from Salla API if available
 *
 * Security:
 * - Google API Keys (PAGESPEED_API_KEY / GOOGLE_API_KEY) remain strictly server-side.
 * - Prevents SSRF / unsafe URLs.
 */

import { introspectEmbeddedToken, merchantApi } from "./_lib/salla.js";

const PAGESPEED_API_BASE = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CRUX_API_BASE = "https://chromeuxreport.googleapis.com/v1/records:queryRecord";

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
 * Executes a single PageSpeed Insights request
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

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" }
    });

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
      return {
        ok: false,
        status: res.status,
        error: msg
      };
    }

    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err.message || "Failed to connect to PageSpeed API"
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
  const apiKey = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY || "";

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

    // Fetch Mobile and Desktop PageSpeed in parallel
    const [mobilePsi, desktopPsi, cruxMobile, cruxDesktop] = await Promise.all([
      fetchPageSpeed(targetUrl, "mobile", apiKey),
      fetchPageSpeed(targetUrl, "desktop", apiKey),
      fetchCrux(targetUrl, targetOrigin, "PHONE", apiKey),
      fetchCrux(targetUrl, targetOrigin, "DESKTOP", apiKey)
    ]);

    // Handle rate limits or critical failures
    if (!mobilePsi.ok && !desktopPsi.ok) {
      const isRateLimit = mobilePsi.status === 429 || desktopPsi.status === 429;
      return {
        status: isRateLimit ? 429 : 502,
        json: {
          success: false,
          code: isRateLimit ? "rate_limited" : "pagespeed_failed",
          error: isRateLimit
            ? "Google PageSpeed API rate limit reached. Please wait a minute before running another test."
            : mobilePsi.error || desktopPsi.error || "Performance test could not be completed. Please try again later."
        }
      };
    }

    return {
      status: 200,
      json: {
        success: true,
        url: targetUrl,
        mobile: mobilePsi.ok ? mobilePsi.data : null,
        desktop: desktopPsi.ok ? desktopPsi.data : null,
        cruxMobile: cruxMobile.ok ? cruxMobile.data : null,
        cruxDesktop: cruxDesktop.ok ? cruxDesktop.data : null,
        errors: {
          mobile: !mobilePsi.ok ? mobilePsi.error : null,
          desktop: !desktopPsi.ok ? desktopPsi.error : null
        }
      }
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
