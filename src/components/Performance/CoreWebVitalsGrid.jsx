import React from 'react';
import { METRIC_THRESHOLDS, getRatingLabel } from '../../utils/performance/thresholds.js';
import { Info, HelpCircle } from 'lucide-react';

/**
 * Grid of Core Web Vitals metric cards with Google thresholds and rating badges
 */
export default function CoreWebVitalsGrid({ strategy = 'mobile', metrics = {} }) {
  const metricKeys = ['lcp', 'inp', 'cls', 'fcp', 'ttfb'];

  return (
    <div className="perf-vitals-section">
      <div className="perf-section-header">
        <div>
          <h3 className="perf-section-title">Core Web Vitals (مؤشرات الويب الأساسية)</h3>
          <p className="perf-section-subtitle">
            المقاييس التقنية المعتمدة من Google لتقييم سرعة واستقرار المتجر
            {' '}({strategy === 'mobile' ? 'الجوال' : 'الكمبيوتر'})
          </p>
        </div>
        <span className="perf-source-badge">
          المصدر: Google Lighthouse Lab Data
        </span>
      </div>

      <div className="perf-vitals-grid">
        {metricKeys.map((key) => {
          const metric = metrics[key] || {};
          const meta = METRIC_THRESHOLDS[key] || {};
          const rating = metric.rating || 'unknown';
          const ratingLabel = getRatingLabel(rating);

          return (
            <div
              key={key}
              className={`perf-metric-card rating-${rating}`}
              role="article"
              aria-label={`${meta.name || key}: ${metric.displayValue || 'N/A'}`}
            >
              <div className="perf-metric-header">
                <div>
                  <div className="perf-metric-code-row">
                    <span className="perf-metric-code">{key.toUpperCase()}</span>
                    <span className={`perf-metric-pill ${rating}`}>
                      {ratingLabel}
                    </span>
                  </div>
                  <span className="perf-metric-human-name">
                    {meta.name || key}
                  </span>
                </div>
              </div>

              <div className="perf-metric-body">
                <div className="perf-metric-value-row">
                  <span className="perf-metric-val">
                    {metric.displayValue || '—'}
                  </span>
                </div>

                <p className="perf-metric-description">
                  {meta.description || ''}
                </p>

                {metric.note && (
                  <div className="perf-metric-note">
                    <Info size={13} aria-hidden="true" />
                    <span>{metric.note}</span>
                  </div>
                )}
              </div>

              <div className="perf-metric-footer">
                <div className="perf-threshold-guide">
                  <span className="guide-good">≤ {formatThreshold(key, meta.good)} جيد</span>
                  <span className="guide-poor">&gt; {formatThreshold(key, meta.needsImprovement)} ضعيف</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatThreshold(key, val) {
  if (val === undefined || val === null) return '';
  if (key === 'cls') return val.toFixed(2);
  if (val >= 1000) return `${(val / 1000).toFixed(1)}s`;
  return `${val}ms`;
}
