const API_KEY_STORAGE_KEY = "salla_perf_google_api_key";

/** Read the merchant's optional Google PageSpeed API key from localStorage. */
export function getStoredGoogleApiKey() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return "";
    return window.localStorage.getItem(API_KEY_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

/** Persist (or remove, when empty) the Google PageSpeed API key. */
export function saveStoredGoogleApiKey(key) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    if (key && key.trim()) {
      window.localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
    } else {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch (err) {
    console.warn("Failed to save Google API key to localStorage", err);
  }
}
