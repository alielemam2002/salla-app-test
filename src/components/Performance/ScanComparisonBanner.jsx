import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  GitCompare,
  Minus,
} from "lucide-react";
import { Badge } from "../ui/index.js";
import {
  formatDateTime,
  getStrategyLabel,
} from "../../utils/performance/formatters.js";
import PerfSection from "./PerfSection.jsx";

const DELTA_ROWS = [
  { key: "score", title: "Performance Score", isScore: true },
  { key: "lcp", title: "LCP (سرعة التحميل)" },
  { key: "cls", title: "CLS (ثبات العناصر)" },
  { key: "fcp", title: "FCP (أول ظهور)" },
  { key: "ttfb", title: "TTFB (استجابة الخادم)" },
];

const STATUS = {
  improved: { icon: ArrowUpRight, label: "تحسن", tone: "success" },
  regressed: { icon: ArrowDownRight, label: "تراجع", tone: "danger" },
  stable: { icon: Minus, label: "مستقر", tone: "neutral" },
};

function DeltaItem({ title, diff, isScore }) {
  if (!diff || diff.status === "no-data") return null;
  const status = STATUS[diff.status] || STATUS.stable;

  return (
    <div className={`perf-delta perf-delta--${diff.status}`}>
      <div className="perf-delta-head">
        <span className="perf-delta-name">{title}</span>
        <Badge tone={status.tone} icon={status.icon}>
          {status.label}
        </Badge>
      </div>
      <div className="perf-delta-values">
        <strong>{isScore ? `${diff.current} نقطة` : diff.formattedCur}</strong>
        <span className="perf-muted" aria-hidden="true">
          ←
        </span>
        <span className="perf-muted">
          {isScore ? `${diff.previous}` : diff.formattedPrev}
        </span>
      </div>
      <div className="perf-delta-label">{diff.label}</div>
    </div>
  );
}

/**
 * Current scan vs the previous saved scan. Data comes from
 * useScanComparison(); renders nothing when there is no previous scan.
 */
export default function ScanComparisonBanner({ data, strategy = "mobile" }) {
  if (!data) return null;
  const { comparison, previousScan } = data;

  return (
    <PerfSection
      icon={GitCompare}
      className="perf-compare"
      ariaLabel="مقارنة الفحص الحالي بالفحص السابق"
      title={`مقارنة بالفحص السابق (${getStrategyLabel(strategy)})`}
      actions={
        <span className="perf-muted perf-inline-icon">
          <Clock size={13} aria-hidden="true" />
          الفحص السابق: {formatDateTime(previousScan.createdAt)}
        </span>
      }
    >
      <div className="perf-delta-grid">
        {DELTA_ROWS.map((row) => (
          <DeltaItem
            key={row.key}
            title={row.title}
            diff={comparison[row.key]}
            isScore={row.isScore}
          />
        ))}
      </div>
    </PerfSection>
  );
}
