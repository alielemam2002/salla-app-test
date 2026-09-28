import { useId } from "react";
import { Calendar } from "lucide-react";
import { CHART_SIZE } from "../../utils/performance/trendChart.js";
import {
  formatDateTime,
  formatShortDate,
} from "../../utils/performance/formatters.js";

/**
 * Pure SVG line chart. Geometry comes precomputed from buildTrendChart();
 * this component only draws it and reports hover.
 */
export default function TrendChartSvg({
  chart,
  metricConfig,
  hoveredPoint,
  onHover,
}) {
  const { width, height, padding } = CHART_SIZE;
  const gradientId = `perf-trend-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const { coords, pathD, areaD, yTicks } = chart;
  const latest = coords[coords.length - 1];

  return (
    <div className="perf-chart" dir="ltr">
      <svg
        className="perf-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`رسم بياني لتطور ${metricConfig.label}: ${coords.length} فحص، آخر قيمة ${latest ? metricConfig.format(latest.value) : "—"}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="perf-chart-stop" stopOpacity="0.28" />
            <stop offset="100%" className="perf-chart-stop" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              className="perf-chart-grid"
              x1={padding.left}
              y1={tick.y}
              x2={width - padding.right}
              y2={tick.y}
            />
            <text
              className="perf-chart-label"
              x={padding.left - 8}
              y={tick.y + 4}
              textAnchor="end"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {areaD && <path d={areaD} fill={`url(#${gradientId})`} />}
        {pathD && <path d={pathD} className="perf-chart-line" />}

        {coords.map((pt, i) => (
          <g key={pt.id || i}>
            <circle
              className="perf-chart-point"
              cx={pt.x}
              cy={pt.y}
              r={hoveredPoint?.id === pt.id ? 6 : 4}
            />
            <circle
              className="perf-chart-hit"
              cx={pt.x}
              cy={pt.y}
              r="14"
              onMouseEnter={() => onHover(pt)}
              onMouseLeave={() => onHover(null)}
            />
            {pt.showLabel && (
              <text
                className="perf-chart-label"
                x={pt.x}
                y={height - 12}
                textAnchor="middle"
              >
                {formatShortDate(pt.createdAt)}
              </text>
            )}
          </g>
        ))}
      </svg>

      {hoveredPoint && (
        <div
          className="perf-chart-tooltip"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100}%`,
          }}
        >
          <div className="perf-chart-tooltip-date">
            <Calendar size={11} aria-hidden="true" />
            <span>{formatDateTime(hoveredPoint.createdAt)}</span>
          </div>
          <strong>{metricConfig.format(hoveredPoint.value)}</strong>
        </div>
      )}
    </div>
  );
}
