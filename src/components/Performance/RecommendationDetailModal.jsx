import React from 'react';
import { X, AlertTriangle, ArrowRight, ShieldCheck, FileCode, CheckCircle2, ExternalLink } from 'lucide-react';
import { formatBytes, formatSavingsMs } from '../../utils/performance/recommendations.js';

/**
 * Detailed Audit Modal for an individual recommendation
 */
export default function RecommendationDetailModal({
  recommendation,
  onClose
}) {
  if (!recommendation) return null;

  const {
    title,
    description,
    impact,
    metric,
    affectedMetric,
    categoryLabel,
    savingsMs,
    savingsBytes,
    whyItMatters,
    howToFix = [],
    items = []
  } = recommendation;

  const targetMetric = affectedMetric || metric;

  return (
    <div
      className="perf-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perf-modal-title"
      onClick={onClose}
    >
      <div
        className="perf-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="perf-modal-header">
          <div className="perf-modal-title-group">
            <div className="perf-modal-badges">
              <span className={`perf-impact-badge ${impact}`}>
                {impact === 'high' ? 'أولوية قصوى' : impact === 'medium' ? 'أولوية متوسطة' : 'تحسين إضافي'}
              </span>
              {targetMetric && (
                <span className="perf-metric-tag">
                  المؤشر المتأثر: <strong>{targetMetric}</strong>
                </span>
              )}
              {categoryLabel && (
                <span className="perf-cat-tag">{categoryLabel}</span>
              )}
            </div>
            <h3 id="perf-modal-title" className="perf-modal-title">
              {title}
            </h3>
          </div>

          <button
            type="button"
            className="perf-modal-close-btn"
            onClick={onClose}
            aria-label="إغلاق النافذة"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="perf-modal-body">
          {/* Savings Callout if available */}
          {(savingsMs || savingsBytes) && (
            <div className="perf-savings-callout">
              <span className="perf-callout-title">التوفير المتوقع المكتشف بواسطة Google:</span>
              <div className="perf-callout-values">
                {savingsMs > 0 && (
                  <div className="perf-stat-box">
                    <span className="perf-stat-label">الوقت المحفوظ تقريبياً:</span>
                    <strong className="perf-stat-num highlight">~{formatSavingsMs(savingsMs)}</strong>
                  </div>
                )}
                {savingsBytes > 0 && (
                  <div className="perf-stat-box">
                    <span className="perf-stat-label">حجم البيانات المحفوظ:</span>
                    <strong className="perf-stat-num highlight">{formatBytes(savingsBytes)}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Why it matters */}
          <div className="perf-section-block">
            <h4 className="perf-block-title">
              <AlertTriangle size={16} className="text-amber" aria-hidden="true" />
              لماذا يؤثر هذا على متجرك؟
            </h4>
            <p className="perf-block-text">
              {whyItMatters || description}
            </p>
          </div>

          {/* How to fix */}
          <div className="perf-section-block">
            <h4 className="perf-block-title">
              <CheckCircle2 size={16} className="text-emerald" aria-hidden="true" />
              خطوات الحل والتطبيق
            </h4>
            <ul className="perf-steps-list">
              {howToFix.length > 0 ? (
                howToFix.map((step, idx) => (
                  <li key={idx} className="perf-step-item">
                    <span className="step-number">{idx + 1}</span>
                    <span className="step-text">{step}</span>
                  </li>
                ))
              ) : (
                <li className="perf-step-item">
                  <span className="step-number">1</span>
                  <span className="step-text">{description}</span>
                </li>
              )}
            </ul>
          </div>

          {/* Affected Assets / Items if returned by Lighthouse */}
          {items.length > 0 && (
            <div className="perf-section-block">
              <h4 className="perf-block-title">
                <FileCode size={16} aria-hidden="true" />
                الملفات والعناصر المتسببة في المشكلة ({items.length})
              </h4>
              <div className="perf-items-table-wrapper">
                <table className="perf-items-table">
                  <thead>
                    <tr>
                      <th>رابط الملف أو العنصر</th>
                      <th>الحجم / التأخير</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="item-url-cell" title={item.url || item.label}>
                          <code>{truncateUrl(item.url || item.label)}</code>
                        </td>
                        <td className="item-savings-cell">
                          {item.wastedBytes ? formatBytes(item.wastedBytes) : item.wastedMs ? `${Math.round(item.wastedMs)}ms` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Source Attribution */}
          <div className="perf-modal-footer-meta">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>المصدر: Google Lighthouse Audit Diagnostics</span>
          </div>
        </div>

        {/* Footer */}
        <div className="perf-modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

function truncateUrl(url) {
  if (!url) return '';
  if (url.length <= 60) return url;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.length > 30 ? '...' + parsed.pathname.slice(-25) : parsed.pathname;
    return `${parsed.origin}${path}`;
  } catch {
    return url.slice(0, 30) + '...' + url.slice(-25);
  }
}
