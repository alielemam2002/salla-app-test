import { ChevronLeft } from "lucide-react";
import { Badge } from "../ui/index.js";
import {
  getImpactLabel,
  impactToTone,
} from "../../utils/performance/formatters.js";

function savingsText(rec) {
  return rec.formattedSavingsMs || rec.formattedSavingsBytes || null;
}

/** Keyboard-accessible clickable wrapper used by cards and rows. */
function clickableProps(onOpen) {
  return {
    role: "button",
    tabIndex: 0,
    onClick: onOpen,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    },
  };
}

/** Highlighted top-3 opportunity card. */
export function TopOpportunityCard({ rec, rank, onOpen }) {
  const savings = savingsText(rec);
  return (
    <div
      className={`perf-top-card perf-top-card--${rec.impact}`}
      {...clickableProps(onOpen)}
    >
      <div className="perf-top-card-meta">
        <span className="perf-top-card-rank">#{rank}</span>
        <Badge tone={impactToTone(rec.impact)}>
          {rec.impact === "high" ? "أثر كبير [HIGH]" : "أثر متوسط [MEDIUM]"}
        </Badge>
        {rec.affectedMetric && <Badge tone="info">{rec.affectedMetric}</Badge>}
      </div>

      <h4 className="perf-top-card-title">{rec.title}</h4>

      <div className="perf-top-card-savings">
        {savings ? (
          <>
            توفير محتمل: <strong>{savings}</strong>
          </>
        ) : (
          <span className="perf-muted">إمكانية تحسين متاحة</span>
        )}
      </div>

      <span className="perf-top-card-cta">
        عرض خطوات المعالجة
        <ChevronLeft size={16} aria-hidden="true" />
      </span>
    </div>
  );
}

/** One row in the full recommendations list. */
export function RecommendationRow({ rec, onOpen }) {
  const savings = savingsText(rec);
  return (
    <div className="perf-rec-row" {...clickableProps(onOpen)}>
      <div className="perf-rec-main">
        <div className="perf-rec-meta">
          <Badge tone={impactToTone(rec.impact)}>
            {getImpactLabel(rec.impact)}
          </Badge>
          {rec.affectedMetric && (
            <Badge tone="info">{rec.affectedMetric}</Badge>
          )}
          {rec.categoryLabel && <Badge>{rec.categoryLabel}</Badge>}
        </div>
        <h4 className="perf-rec-title">{rec.title}</h4>
        <p className="perf-rec-desc">{rec.description}</p>
      </div>

      <div className="perf-rec-side">
        {savings ? (
          <div className="perf-rec-savings">
            <span>توفير</span>
            <strong>{savings}</strong>
          </div>
        ) : (
          <span className="perf-muted">تحسين متاح</span>
        )}
        <ChevronLeft
          size={18}
          className="perf-rec-chevron"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
