import { useCallback, useEffect, useRef } from "react";

const HIGHLIGHT_CLASS = "field-highlight-pulse";
const HIGHLIGHT_MS = 2500;

/** Scroll to a field anchor by id, pulse-highlight it and focus its input. */
export function useFieldNavigator() {
  const timers = useRef([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return useCallback((fieldId) => {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add(HIGHLIGHT_CLASS);
    timers.current.push(
      setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), HIGHLIGHT_MS),
    );
    const input = el.querySelector("input, textarea, select");
    if (input) input.focus({ preventScroll: true });
  }, []);
}
