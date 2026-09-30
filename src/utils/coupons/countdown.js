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

/** "04 ي 12 س 33 د 17 ث" (days, hours, minutes, seconds) */
export function formatCountdown({ days, hours, minutes, seconds }) {
  return `${pad(days)} ي ${pad(hours)} س ${pad(minutes)} د ${pad(seconds)} ث`;
}

/** Arabic count phrase: [one, two, few (3-10), many (11+)] */
const unit = (n, [one, two, few, many]) => {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${n >= 3 && n <= 10 ? few : many}`;
};

const DAYS = ["يوم واحد", "يومان", "أيام", "يومًا"];
const HOURS = ["ساعة واحدة", "ساعتان", "ساعات", "ساعة"];
const MINUTES = ["دقيقة واحدة", "دقيقتان", "دقائق", "دقيقة"];

/**
 * Minute-precision text for screen readers ("4 أيام و 12 ساعة و 33 دقيقة"),
 * so the accessible label changes at most once a minute.
 */
export function describeCountdown({ days, hours, minutes, done }) {
  if (done) return "الآن";
  const parts = [];
  if (days) parts.push(unit(days, DAYS));
  if (hours) parts.push(unit(hours, HOURS));
  if (minutes || !parts.length) parts.push(unit(minutes, MINUTES));
  return parts.join(" و ");
}
