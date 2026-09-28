import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Wrap an async function with pending/error state.
 * `run(...args)` resolves to the function's result, or `undefined` if it threw
 * (the message is kept in `error`).
 */
export function useAsyncAction(fn) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  const mounted = useRef(true);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args) => {
    setPending(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (err) {
      if (mounted.current) setError(err?.message || String(err));
      return undefined;
    } finally {
      if (mounted.current) setPending(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { run, pending, error, setError, reset };
}
