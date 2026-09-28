const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Split a remaining duration (ms) into whole days/hours/minutes/seconds. */
export function getCountdownParts(remainingMs) {
  const ms = Math.max(0, Math.floor(remainingMs));
  return {
    days: Math.floor(ms / DAY),
    hours: Math.floor((ms % DAY) / HOUR),
    minutes: Math.floor((ms % HOUR) / MINUTE),
    seconds: Math.floor((ms % MINUTE) / SECOND),
    done: ms === 0,
  };
}

const pad = (n) => String(n).padStart(2, "0");

/** "04d 12h 33m 17s" */
export function formatCountdown({ days, hours, minutes, seconds }) {
  return `${pad(days)}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

const unit = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Minute-precision text for screen readers ("4 days 12 hours 33 minutes"),
 * so the accessible label changes at most once a minute.
 */
export function describeCountdown({ days, hours, minutes, done }) {
  if (done) return "now";
  const parts = [];
  if (days) parts.push(unit(days, "day"));
  if (hours) parts.push(unit(hours, "hour"));
  if (minutes || !parts.length) parts.push(unit(minutes, "minute"));
  return parts.join(" ");
}
