import { getScoreRating } from "../../utils/performance/thresholds.js";

const CIRCUMFERENCE = 283; // 2πr for r = 45

/** Circular 0–100 score ring coloured by rating. */
export default function ScoreGauge({ score, label = "Performance Score" }) {
  const hasScore = score !== null && score !== undefined;
  const rating = getScoreRating(score);
  const offset = hasScore
    ? CIRCUMFERENCE - (CIRCUMFERENCE * Math.min(100, Math.max(0, score))) / 100
    : CIRCUMFERENCE;

  return (
    <div
      className={`perf-gauge perf-gauge--${rating}`}
      role="img"
      aria-label={hasScore ? `${label}: ${score} / 100` : `${label}: —`}
    >
      <svg viewBox="0 0 100 100" width="132" height="132" aria-hidden="true">
        <circle className="perf-gauge-track" cx="50" cy="50" r="45" />
        <circle
          className="perf-gauge-value-ring"
          cx="50"
          cy="50"
          r="45"
          style={{ strokeDasharray: CIRCUMFERENCE, strokeDashoffset: offset }}
        />
      </svg>
      <div className="perf-gauge-center" aria-hidden="true">
        <span className="perf-gauge-number">{hasScore ? score : "—"}</span>
        <span className="perf-gauge-max">/ 100</span>
      </div>
    </div>
  );
}
