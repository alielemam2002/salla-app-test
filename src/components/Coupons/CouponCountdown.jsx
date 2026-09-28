import { memo } from "react";
import { useCountdown } from "../../hooks/coupons/useCouponClock.js";
import {
  describeCountdown,
  formatCountdown,
  getCountdownParts,
} from "../../utils/coupons/countdown.js";

/**
 * Self-contained ticking countdown. Only this component re-renders every
 * second. The visible digits are hidden from screen readers; they get a
 * minute-precision sentence instead, and aria-live is off so nothing is
 * announced while it ticks.
 */
function CouponCountdown({ target, label }) {
  const parts = getCountdownParts(useCountdown(target));
  return (
    <div className="coupon-countdown" role="timer" aria-live="off">
      <span className="coupon-countdown-label" aria-hidden="true">
        {label}
      </span>
      <span className="coupon-countdown-value" aria-hidden="true">
        {formatCountdown(parts)}
      </span>
      <span className="sr-only">
        {label} {describeCountdown(parts)}
      </span>
    </div>
  );
}

export default memo(CouponCountdown);
