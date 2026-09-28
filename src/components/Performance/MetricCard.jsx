import { Info } from "lucide-react";
import { formatThreshold } from "../../utils/performance/formatters.js";
import RatingBadge from "./RatingBadge.jsx";

/** One Core Web Vital: code, rating, value, description and thresholds. */
export default function MetricCard({ metricKey, metric = {}, meta = {} }) {
  const rating = metric.rating || "unknown";
  const name = meta.name || metricKey;

  return (
    <article
      className={`perf-metric perf-metric--${rating}`}
      aria-label={`${name}: ${metric.displayValue || "N/A"}`}
    >
      <header className="perf-metric-head">
        <span className="perf-metric-code">{metricKey.toUpperCase()}</span>
        <RatingBadge rating={rating} />
      </header>
      <span className="perf-metric-name">{name}</span>

      <span className="perf-metric-value">{metric.displayValue || "—"}</span>

      {meta.description && (
        <p className="perf-metric-desc">{meta.description}</p>
      )}

      {metric.note && (
        <div className="perf-metric-note">
          <Info size={13} aria-hidden="true" />
          <span>{metric.note}</span>
        </div>
      )}

      <footer className="perf-metric-thresholds">
        <span className="is-good">
          ≤ {formatThreshold(metricKey, meta.good)} جيد
        </span>
        <span className="is-poor">
          &gt; {formatThreshold(metricKey, meta.needsImprovement)} ضعيف
        </span>
      </footer>
    </article>
  );
}
