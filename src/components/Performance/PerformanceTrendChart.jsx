import { Activity, TrendingUp } from "lucide-react";
import { EmptyState, SegmentedTabs } from "../ui/index.js";
import { useTrendChart } from "../../hooks/performance/useTrendChart.js";
import {
  TREND_METRICS,
  TREND_RANGES,
} from "../../utils/performance/trendChart.js";
import { getStrategyLabel } from "../../utils/performance/formatters.js";
import PerfSection from "./PerfSection.jsx";
import TrendChartSvg from "./TrendChartSvg.jsx";

const METRIC_TABS = Object.entries(TREND_METRICS).map(([id, m]) => ({
  id,
  label: m.label,
}));

const RANGE_TABS = TREND_RANGES.map((d) => ({ id: d, label: `${d}D` }));

/** History of scans for the selected device, with metric + range switches. */
export default function PerformanceTrendChart({
  history = [],
  strategy = "mobile",
  selectedDays = 30,
  onDaysChange,
}) {
  const {
    selectedMetric,
    setSelectedMetric,
    metricConfig,
    hasData,
    chart,
    hoveredPoint,
    setHoveredPoint,
  } = useTrendChart(history);

  return (
    <PerfSection
      icon={TrendingUp}
      ariaLabel="مخطط أداء المتجر عبر الوقت"
      title="Performance History & Trends (تطور الأداء)"
      description={`متابعة دقيقة لمؤشرات السرعة للأجهزة المحددة (${getStrategyLabel(strategy)})`}
      actions={
        <SegmentedTabs
          variant="pill"
          tabs={RANGE_TABS}
          activeTab={selectedDays}
          onTabChange={onDaysChange}
          ariaLabel="المدى الزمني"
        />
      }
    >
      <SegmentedTabs
        variant="pill"
        className="perf-filter-tabs"
        tabs={METRIC_TABS}
        activeTab={selectedMetric}
        onTabChange={setSelectedMetric}
        ariaLabel="اختر المؤشر لعرض المخطط"
      />

      {hasData ? (
        <TrendChartSvg
          chart={chart}
          metricConfig={metricConfig}
          hoveredPoint={hoveredPoint}
          onHover={setHoveredPoint}
        />
      ) : (
        <EmptyState
          icon={Activity}
          title={`لا توجد فحوصات مسجلة كافية في نطاق الـ ${selectedDays} يوماً`}
          description='اضغط على "بدء فحص الأداء" لحفظ أول نقطة فحص في سجل متجرك ومتابعة التطور مستقبلاً.'
        />
      )}
    </PerfSection>
  );
}
