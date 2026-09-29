/**
 * Vercel Serverless Function - Storefront coupon announcement bar
 *
 * The bar is stored in the app's own Salla settings, so no database is needed:
 * - get:   GET  /admin/v2/apps/{app_id}/settings
 * - set:   GET, then POST /admin/v2/apps/{app_id}/settings with every key
 * - clear: same as set, with coupon_bar_enabled = false
 * (docs: https://docs.salla.dev/5401096e0.md, https://docs.salla.dev/5401097e0.md)
 *
 * The storefront snippet (snippets/coupon-announcement-bar.js) reads the same
 * keys with salla.config.get("app.coupon_bar_*"). They must be defined as
 * `public: true` fields in the app's settings form, or the snippet reads
 * undefined.
 *
 * Salla's settings POST is a full replace: a missing key becomes null. So the
 * current settings are always read first and merged.
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

const sallaFail = (status, result, fallback) =>
  fail(
    status >= 400 ? status : 502,
    "salla_api_error",
    result?.error?.message || fallback,
    result?.error?.fields || null,
  );

export const BAR_KEYS = [
  "coupon_bar_enabled",
  "coupon_bar_code",
  "coupon_bar_text",
  "coupon_bar_bg_color",
  "coupon_bar_text_color",
  "coupon_bar_ends_at",
];

const MAX_TEXT = 200;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const SALLA_DATE_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?$/;

/** Salla wall-clock date (store time) → ISO with the +03:00 store offset. */
export function sallaDateToIso(value) {
  const match = String(value || "")
    .trim()
    .match(SALLA_DATE_RE);
  if (!match) return "";
  return `${match[1]}T${match[2]}${match[3] || ":00"}+03:00`;
}

// Salla may send booleans as the string "true".
const toBool = (value) => value === true || value === "true" || value === 1;

/** Settings object → the bar the UI works with (null when off). */
export function readBar(settings) {
  if (!settings || !toBool(settings.coupon_bar_enabled)) return null;
  return {
    code: String(settings.coupon_bar_code || ""),
    text: String(settings.coupon_bar_text || ""),
    bg_color: String(settings.coupon_bar_bg_color || ""),
    text_color: String(settings.coupon_bar_text_color || ""),
    ends_at: String(settings.coupon_bar_ends_at || ""),
  };
}

/**
 * Validate the client's bar input and return the settings keys to write.
 * Returns { values } or { fields } with validation messages.
 */
export function buildBarSettings(input) {
  const fields = {};
  const code = String(input?.code || "").trim();
  // One line only: the bar is a single strip.
  const text = String(input?.text || "")
    .replace(/\s+/g, " ")
    .trim();
  const bgColor = String(input?.bg_color || "").trim();
  const textColor = String(input?.text_color || "").trim();
  const endsAt = sallaDateToIso(input?.ends_at);

  if (!code || /\s/.test(code))
    fields.code = ["A valid coupon code is required"];
  if (!text) fields.text = ["Bar text is required"];
  else if (text.length > MAX_TEXT) {
    fields.text = [`Bar text can't be longer than ${MAX_TEXT} characters`];
  }
  if (!COLOR_RE.test(bgColor))
    fields.bg_color = ["Use a hex color like #004d5b"];
  if (!COLOR_RE.test(textColor)) {
    fields.text_color = ["Use a hex color like #ffffff"];
  }
  if (!endsAt) fields.ends_at = ["The coupon's end date is required"];

  if (Object.keys(fields).length) return { fields };
  return {
    values: {
      coupon_bar_enabled: true,
      coupon_bar_code: code,
      coupon_bar_text: text,
      coupon_bar_bg_color: bgColor,
      coupon_bar_text_color: textColor,
      coupon_bar_ends_at: endsAt,
    },
  };
}

async function loadSettings(appId) {
  const { status, body } = await merchantApi(
    `/apps/${encodeURIComponent(String(appId))}/settings`,
  );
  if (!body.success) return { status, body };
  const settings = body.data?.settings;
  // An app with no saved settings can come back as [] instead of {}.
  return {
    status,
    body,
    settings:
      settings && typeof settings === "object" && !Array.isArray(settings)
        ? settings
        : {},
  };
}

async function saveSettings(appId, settings) {
  return merchantApi(`/apps/${encodeURIComponent(String(appId))}/settings`, {
    method: "POST",
    body: settings,
  });
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
  const action = String(body.action || "get").toLowerCase();

  if (!token) return fail(400, "bad_request", "Token is required");
  if (!appId) return fail(400, "bad_request", "App ID is required");
  if (!["get", "set", "clear"].includes(action)) {
    return fail(400, "bad_request", `Unknown action: "${action}"`);
  }

  try {
    const session = await introspectEmbeddedToken(token, appId);
    if (!session.ok) {
      return fail(session.status, "session_invalid", session.error);
    }

    let values = null;
    if (action === "set") {
      const built = buildBarSettings(body.bar);
      if (built.fields) {
        return fail(
          422,
          "validation_failed",
          "Some bar fields are invalid",
          built.fields,
        );
      }
      values = built.values;
    }

    const current = await loadSettings(appId);
    if (!current.body.success) {
      return sallaFail(
        current.status,
        current.body,
        `Failed to read app settings (status ${current.status})`,
      );
    }

    if (action === "get") {
      return Response.json({ success: true, bar: readBar(current.settings) });
    }

    if (action === "clear") {
      const bar = readBar(current.settings);
      // Only clear the bar if it still belongs to this coupon, so turning the
      // option off on one coupon never removes another coupon's bar.
      const onlyCode = String(body.code || "").trim();
      if (!bar || (onlyCode && bar.code !== onlyCode)) {
        return Response.json({ success: true, bar });
      }
      values = { coupon_bar_enabled: false };
    }

    const next = { ...current.settings, ...values };
    for (const key of BAR_KEYS) if (!(key in next)) next[key] = "";

    const { status, body: result } = await saveSettings(appId, next);
    if (!result.success) {
      return sallaFail(
        status,
        result,
        `Failed to save app settings (status ${status})`,
      );
    }
    return Response.json({ success: true, bar: readBar(next) });
  } catch (error) {
    console.error("Coupon bar endpoint failed:", error);
    return fail(
      error.status || ERROR_STATUS[error.code] || 500,
      error.code || "server_error",
      error.message || "Internal server error",
    );
  }
}
