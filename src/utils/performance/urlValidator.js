/**
 * URL Validator & Normalizer for Store Performance Testing
 */

/**
 * Validates and normalizes a given store URL
 * @param {string} input - Raw URL string
 * @returns {{ isValid: boolean, error: string | null, normalizedUrl: string | null, hostname: string | null }}
 */
export function validateStoreUrl(input) {
  if (!input || typeof input !== "string" || !input.trim()) {
    return {
      isValid: false,
      error: "يرجى إدخال رابط المتجر المراد فحصه.",
      normalizedUrl: null,
      hostname: null,
    };
  }

  let trimmed = input.trim();

  // Block unsafe schemes
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return {
      isValid: false,
      error: "الرابط يحتوي على بروتوكول غير آمن.",
      normalizedUrl: null,
      hostname: null,
    };
  }

  // Prepend https:// if no scheme is provided
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);

    // Only allow http and https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        isValid: false,
        error: "يجب أن يبدأ الرابط بـ https:// أو http://",
        normalizedUrl: null,
        hostname: null,
      };
    }

    // Hostname must be valid
    const hostname = parsed.hostname.toLowerCase();
    if (
      !hostname ||
      hostname.length < 3 ||
      !hostname.includes(".") ||
      hostname.startsWith(".") ||
      hostname.endsWith(".") ||
      /\s/.test(hostname)
    ) {
      return {
        isValid: false,
        error: "اسم النطاق (Domain) غير صالح. مثال: https://store.example.sa",
        normalizedUrl: null,
        hostname: null,
      };
    }

    // Normalize: remove fragments, keep path/search, strip trailing slash on root
    parsed.hash = "";
    let normalized = parsed.toString();
    // If it ends with a trailing slash and path is just "/", keep https://domain.com/ or strip?
    // Standardize: if pathname is "/", normalized url is https://example.com/
    if (parsed.pathname === "/" && !parsed.search) {
      normalized = `${parsed.protocol}//${parsed.host}`;
    }

    return {
      isValid: true,
      error: null,
      normalizedUrl: normalized,
      hostname,
    };
  } catch {
    return {
      isValid: false,
      error: "صيغة الرابط غير صحيحة، يرجى كتابة رابط صالح مثل: https://mystore.salla.sa",
      normalizedUrl: null,
      hostname: null,
    };
  }
}

export const validateAndNormalizeUrl = validateStoreUrl;

export function isValidUrl(url) {
  return validateStoreUrl(url).isValid;
}
