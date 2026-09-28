import { Activity } from "lucide-react";
import { Badge } from "../ui/index.js";
import { METRIC_THRESHOLDS } from "../../utils/performance/thresholds.js";
import { getStrategyLabel } from "../../utils/performance/formatters.js";
import PerfSection from "./PerfSection.jsx";
import MetricCard from "./MetricCard.jsx";

const METRIC_KEYS = ["lcp", "inp", "cls", "fcp", "ttfb"];

/** Grid of Core Web Vitals (lab data) with Google thresholds. */
export default function CoreWebVitalsGrid({
  strategy = "mobile",
  metrics = {},
}) {
  return (
    <PerfSection
      icon={Activity}
      title="Core Web Vitals (مؤشرات الويب الأساسية)"
      description={`المقاييس التقنية المعتمدة من Google لتقييم سرعة واستقرار المتجر (${getStrategyLabel(strategy)})`}
      actions={<Badge>المصدر: Google Lighthouse Lab Data</Badge>}
    >
      <div className="perf-metric-grid">
        {METRIC_KEYS.map((key) => (
          <MetricCard
            key={key}
            metricKey={key}
            metric={metrics[key]}
            meta={METRIC_THRESHOLDS[key]}
          />
        ))}
      </div>
    </PerfSection>
  );
}
