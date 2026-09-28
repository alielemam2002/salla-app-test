import { useCallback, useState } from "react";
import {
  getStoredGoogleApiKey,
  saveStoredGoogleApiKey,
} from "../../utils/performance/apiKeyStorage.js";

/** The optional Google PageSpeed API key, persisted in localStorage. */
export function useGoogleApiKey() {
  const [apiKey, setApiKey] = useState(() => getStoredGoogleApiKey());

  const saveKey = useCallback((key) => {
    saveStoredGoogleApiKey(key);
    setApiKey((key || "").trim());
  }, []);

  const clearKey = useCallback(() => {
    saveStoredGoogleApiKey("");
    setApiKey("");
  }, []);

  return { apiKey, hasKey: Boolean(apiKey), saveKey, clearKey };
}
