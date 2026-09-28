import { useMemo, useState } from "react";
import {
  TREND_METRICS,
  buildTrendChart,
  pickTrendPoints,
} from "../../utils/performance/trendChart.js";

/** Selected metric, hover state and computed geometry for the trend chart. */
export function useTrendChart(history) {
  const [selectedMetric, setSelectedMetric] = useState("performanceScore");
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const points = useMemo(
    () => pickTrendPoints(history, selectedMetric),
    [history, selectedMetric],
  );

  const chart = useMemo(
    () => buildTrendChart(points, selectedMetric),
    [points, selectedMetric],
  );

  return {
    selectedMetric,
    setSelectedMetric,
    metricConfig:
      TREND_METRICS[selectedMetric] || TREND_METRICS.performanceScore,
    hasData: points.length > 0,
    chart,
    hoveredPoint,
    setHoveredPoint,
  };
}
