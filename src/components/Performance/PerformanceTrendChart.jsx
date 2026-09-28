import React, { useState, useMemo } from 'react';
import { TrendingUp, Calendar, Activity } from 'lucide-react';
import { formatMetricValue } from '../../utils/performance/thresholds.js';

/**
 * Lightweight SVG Trend Chart for Performance History
 * Zero external library dependencies, fast, responsive, and accessible.
 */
export default function PerformanceTrendChart({
  history = [],
  strategy = 'mobile',
  selectedDays = 30,
  onDaysChange
}) {
  const [selectedMetric, setSelectedMetric] = useState('performanceScore');
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const metricsConfig = {
    performanceScore: {
      label: 'Performance Score',
      unit: 'نقطة',
      isHigherBetter: true,
      min: 0,
      max: 100,
      format: (v) => `${v} نقطة`
    },
    lcp: {
      label: 'LCP (أكبر محتوى)',
      unit: 'ثانية',
      isHigherBetter: false,
      format: (v) => formatMetricValue('lcp', v)
    },
    inp: {
      label: 'INP (تفاعل المستخدم)',
      unit: 'مللي ثانية',
      isHigherBetter: false,
      format: (v) => formatMetricValue('inp', v)
    },
    cls: {
      label: 'CLS (استقرار العناصر)',
      unit: '',
      isHigherBetter: false,
      format: (v) => formatMetricValue('cls', v)
    }
  };

  const currentMetricConfig = metricsConfig[selectedMetric] || metricsConfig.performanceScore;

  // Filter history points that have values for the selected metric
  const validPoints = useMemo(() => {
    return history
      .filter((item) => {
        const val = item[selectedMetric];
        return val !== null && val !== undefined && !isNaN(Number(val));
      })
      .map((item) => ({
        ...item,
        value: Number(item[selectedMetric])
      }));
  }, [history, selectedMetric]);

  // SVG Chart Geometry Calculation
  const chartWidth = 600;
  const chartHeight = 220;
  const padding = { top: 25, right: 30, bottom: 40, left: 50 };

  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const { pointsWithCoords, pathD, areaD, yTicks } = useMemo(() => {
    if (validPoints.length === 0) {
      return { pointsWithCoords: [], pathD: '', areaD: '', yTicks: [] };
    }

    const values = validPoints.map(p => p.value);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);

    if (selectedMetric === 'performanceScore') {
      minVal = Math.max(0, Math.floor(minVal / 10) * 10 - 10);
      maxVal = 100;
    } else {
      const paddingVal = (maxVal - minVal) * 0.15 || minVal * 0.1 || 1;
      minVal = Math.max(0, minVal - paddingVal);
      maxVal = maxVal + paddingVal;
    }

    if (maxVal === minVal) {
      maxVal = minVal + 1;
    }

    // Generate 4 Y ticks
    const yTicksArr = [0, 1, 2, 3].map(i => {
      const val = minVal + (maxVal - minVal) * (i / 3);
      const y = padding.top + innerHeight - (innerHeight * (i / 3));
      return { val, y, label: currentMetricConfig.format(val) };
    });

    const coords = validPoints.map((p, idx) => {
      const x = validPoints.length === 1
        ? padding.left + innerWidth / 2
        : padding.left + (idx / (validPoints.length - 1)) * innerWidth;
      const normalizedY = (p.value - minVal) / (maxVal - minVal);
      const y = padding.top + innerHeight - (normalizedY * innerHeight);
      return { ...p, x, y };
    });

    // Build SVG path
    let d = '';
    coords.forEach((pt, i) => {
      if (i === 0) {
        d += `M ${pt.x} ${pt.y}`;
      } else {
        // Smooth curve
        const prev = coords[i - 1];
        const cpX1 = prev.x + (pt.x - prev.x) / 2;
        const cpX2 = prev.x + (pt.x - prev.x) / 2;
        d += ` C ${cpX1} ${prev.y}, ${cpX2} ${pt.y}, ${pt.x} ${pt.y}`;
      }
    });

    // Area path for gradient fill
    let area = '';
    if (coords.length > 0) {
      const firstX = coords[0].x;
      const lastX = coords[coords.length - 1].x;
      const bottomY = padding.top + innerHeight;
      area = `${d} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
    }

    return {
      pointsWithCoords: coords,
      pathD: d,
      areaD: area,
      yTicks: yTicksArr
    };
  }, [validPoints, selectedMetric, innerWidth, innerHeight, currentMetricConfig]);

  const formatDateLabel = (isoDate) => {
    try {
      const d = new Date(isoDate);
      return d.toLocaleDateString('ar-SA', { month: 'numeric', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="perf-trend-section" role="region" aria-label="مخطط أداء المتجر عبر الوقت">
      <div className="perf-trend-header">
        <div className="title-area">
          <div className="perf-title-row">
            <TrendingUp size={20} className="text-primary" aria-hidden="true" />
            <h3 className="perf-section-title">Performance History & Trends (تطور الأداء)</h3>
          </div>
          <p className="perf-section-subtitle">
            متابعة دقيقة لمؤشرات السرعة للأجهزة المحددة ({strategy === 'mobile' ? 'الجوال' : 'الكمبيوتر'})
          </p>
        </div>

        {/* Range Selector */}
        <div className="perf-trend-controls">
          <div className="perf-days-filter" role="tablist" aria-label="المدى الزمني">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={selectedDays === d}
                className={`perf-range-btn ${selectedDays === d ? 'active' : ''}`}
                onClick={() => onDaysChange(d)}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Selector Pills */}
      <div className="perf-metric-pills-row" role="tablist" aria-label="اختر المؤشر لعرض المخطط">
        {Object.entries(metricsConfig).map(([mKey, mMeta]) => (
          <button
            key={mKey}
            type="button"
            role="tab"
            aria-selected={selectedMetric === mKey}
            className={`perf-metric-select-pill ${selectedMetric === mKey ? 'active' : ''}`}
            onClick={() => setSelectedMetric(mKey)}
          >
            {mMeta.label}
          </button>
        ))}
      </div>

      {/* Chart Canvas or Empty State */}
      {validPoints.length === 0 ? (
        <div className="perf-chart-empty" role="status">
          <Activity size={32} className="perf-empty-icon" aria-hidden="true" />
          <p className="empty-title">لا توجد فحوصات مسجلة كافية في نطاق الـ {selectedDays} يوماً</p>
          <span className="empty-desc">
            اضغط على &quot;بدء فحص الأداء&quot; لحفظ أول نقطة فحص في سجل متجرك ومتابعة التطور مستقبلاً.
          </span>
        </div>
      ) : (
        <div className="perf-chart-container">
          <svg
            className="perf-svg-chart"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="xMidYMid meet"
            aria-label={`رسم بياني لتطور ${currentMetricConfig.label}`}
          >
            <defs>
              <linearGradient id="perfLineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {yTicks.map((tick, i) => (
              <g key={i} className="chart-grid-group">
                <line
                  x1={padding.left}
                  y1={tick.y}
                  x2={chartWidth - padding.right}
                  y2={tick.y}
                  stroke="var(--border-color, #e2e8f0)"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--text-secondary, #64748b)"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {/* Area Fill */}
            {areaD && (
              <path
                d={areaD}
                fill="url(#perfLineGradient)"
              />
            )}

            {/* Line Path */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Points & Hover targets */}
            {pointsWithCoords.map((pt, i) => (
              <g key={pt.id || i}>
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredPoint?.id === pt.id ? "6" : "4"}
                  fill="#ffffff"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  className="chart-point"
                />
                {/* Invisible larger circle for easy touch/mouse hovering */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="14"
                  fill="transparent"
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  style={{ cursor: 'pointer' }}
                />
                {/* X axis date label on first, middle, last */}
                {(i === 0 || i === Math.floor(pointsWithCoords.length / 2) || i === pointsWithCoords.length - 1) && (
                  <text
                    x={pt.x}
                    y={chartHeight - 12}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--text-secondary, #64748b)"
                  >
                    {formatDateLabel(pt.createdAt)}
                  </text>
                )}
              </g>
            ))}
          </svg>

          {/* Floating Tooltip */}
          {hoveredPoint && (
            <div
              className="perf-chart-tooltip"
              style={{
                left: `${(hoveredPoint.x / chartWidth) * 100}%`,
                top: `${(hoveredPoint.y / chartHeight) * 100}%`
              }}
            >
              <div className="tooltip-date">
                <Calendar size={11} aria-hidden="true" />
                <span>{new Date(hoveredPoint.createdAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="tooltip-value">
                <strong>{currentMetricConfig.format(hoveredPoint.value)}</strong>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
