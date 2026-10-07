import { embedded } from "@salla.sa/embedded-sdk";

let lastRefreshTime = 0;
const REFRESH_COOLDOWN_MS = 3000;

/**
 * Checks whether an error is caused by an expired or invalid Salla embedded session.
 * @param {any} error
 * @returns {boolean}
 */
export function isSessionInvalidError(error) {
  if (!error) return false;
  if (error.code === "session_invalid" || error.result?.code === "session_invalid") {
    return true;
  }
  if (error.status === 401 || error.result?.status === 401) {
    const msg = error.message || error.result?.error || error.error;
    if (typeof msg === "string" && (msg.includes("جلسة سلة") || msg.includes("رمز الجلسة"))) {
      return true;
    }
  }
  return false;
}

/**
 * Triggers embedded.auth.refresh() with throttling to prevent refresh storms.
 * Salla host will update/re-render the iframe with a new token URL.
 *
 * @param {object} [customEmbedded] - Optional SDK instance override
 * @param {function} [showToast] - Optional toast function
 * @returns {boolean} True if refresh was dispatched to Salla host
 */
export function refreshSallaSession(customEmbedded, showToast) {
  const sdk = customEmbedded || embedded;
  const now = Date.now();

  if (now - lastRefreshTime < REFRESH_COOLDOWN_MS) {
    return false;
  }
  lastRefreshTime = now;

  const isInIframe = typeof window !== "undefined" && window.parent !== window;

  if (sdk?.auth?.refresh && isInIframe) {
    showToast?.("انتهت الجلسة. يجري تحديث الجلسة مع سلة...", "info");
    try {
      sdk.auth.refresh();
      return true;
    } catch {
      // Fall through to notification
    }
  }

  showToast?.("انتهت جلسة سلة أو أنها غير صالحة. أعد فتح التطبيق من لوحة سلة.", "error");
  return false;
}

/**
 * Safely extracts the session token from the embedded SDK instance.
 * @param {object} [customEmbedded]
 * @returns {string|null}
 */
export function getToken(customEmbedded) {
  const sdk = customEmbedded || embedded;
  return sdk?.auth?.getToken?.() || null;
}

/**
 * Resets the cooldown timer (useful in unit tests).
 */
export function _resetRefreshCooldown() {
  lastRefreshTime = 0;
}
