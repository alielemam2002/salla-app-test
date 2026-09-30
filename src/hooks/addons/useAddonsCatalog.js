import { useCallback, useEffect, useRef, useState } from "react";
import logger from "../../utils/logger.js";

/**
 * Loads the app's addons via `embedded.checkout.getAddons()` and tracks the
 * per-addon quantity the merchant picked.
 */
export function useAddonsCatalog({ embedded, logMessage }) {
  const [addons, setAddons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasFetchedRef = useRef(false);

  const loadAddons = useCallback(
    async (force = false) => {
      if (!embedded?.checkout?.getAddons) {
        setError("لا يمكن تحميل الإضافات إلا من داخل لوحة تحكم سلة.");
        setIsLoading(false);
        return;
      }

      // Prevent duplicate fetches from StrictMode, unless forced (refresh button)
      if (!force && hasFetchedRef.current) return;
      hasFetchedRef.current = true;

      setIsLoading(true);
      setError(null);

      try {
        logMessage("outgoing", { event: "embedded::checkout.getAddons" });
        // The response is logged by the global host message listener
        const result = await embedded.checkout.getAddons();
        if (result.success) {
          setAddons(result.addons || []);
        } else {
          setError(
            result.error?.message || "تعذّر تحميل الإضافات، حاول مرة أخرى.",
          );
        }
      } catch (err) {
        logger.error("Failed to fetch addons:", err);
        setError(err.message || "تعذّر تحميل الإضافات، حاول مرة أخرى.");
      } finally {
        setIsLoading(false);
      }
    },
    [embedded, logMessage],
  );

  useEffect(() => {
    loadAddons();
  }, [loadAddons]);

  const setQuantity = useCallback((slug, quantity) => {
    setAddons((prev) =>
      prev.map((a) => (a.slug === slug ? { ...a, _quantity: quantity } : a)),
    );
  }, []);

  const reload = useCallback(() => loadAddons(true), [loadAddons]);

  return { addons, isLoading, error, reload, setQuantity };
}
