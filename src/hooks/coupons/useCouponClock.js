import { useEffect, useState } from "react";
import { nextStatusChange } from "../../utils/coupons/couponModel.js";

// setTimeout overflows above ~24.8 days; re-check at least that often.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * "Now" for status grouping. Unlike the per-card countdowns, it only
 * changes when some coupon actually starts or expires, so the list
 * re-renders once per status change instead of every second.
 */
export function useStatusClock(coupons) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const next = nextStatusChange(coupons, now);
    if (next === null) return undefined;
    const delay = Math.min(Math.max(next - Date.now(), 0) + 50, MAX_TIMEOUT_MS);
    const id = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(id);
  }, [coupons, now]);

  return now;
}

/** Milliseconds left until `target`, updated every second; stops at 0. */
export function useCountdown(target) {
  const [remaining, setRemaining] = useState(() =>
    target ? Math.max(0, target - Date.now()) : 0,
  );

  useEffect(() => {
    if (!target) return undefined;
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    if (target <= Date.now()) return undefined;
    const id = setInterval(() => {
      tick();
      if (Date.now() >= target) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  return remaining;
}
