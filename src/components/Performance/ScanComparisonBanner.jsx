import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, GitCompare, Clock } from 'lucide-react';
import { compareScans, getPreviousScan } from '../../utils/performance/historyStorage.js';

/**
 * Scan Comparison Banner: Compares current test with the previous scan
 */
export default function ScanComparisonBanner({ currentReport, strategy = 'mobile' }) {
  if (!currentReport || !currentReport.url) return null;

  const currentDev = currentReport[strategy];
  if (!currentDev) return null;

  const previousScan = getPreviousScan(currentReport.url, strategy, currentReport.fetchedAt);
  if (!previousScan) return null;

  const comparison = compareScans(currentDev, previousScan);
  if (!comparison) return null;

  const formatPreviousDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderDeltaItem = (title, diffObj, isScore = false) => {
    if (!diffObj || diffObj.status === 'no-data') return null;

    const { status, label, current, previous } = diffObj;
    const isImproved = status === 'improved';
    const isRegressed = status === 'regressed';

    return (
      <div className={`perf-comp-item status-${status}`} key={title}>
        <div className="comp-item-header">
          <span className="comp-metric-name">{title}</span>
          <span className={`comp-status-badge ${status}`}>
            {isImproved && <ArrowUpRight size={14} aria-hidden="true" />}
            {isRegressed && <ArrowDownRight size={14} aria-hidden="true" />}
            {!isImproved && !isRegressed && <Minus size={14} aria-hidden="true" />}
            <span>{isImproved ? 'تحسن' : isRegressed ? 'تراجع' : 'مستقر'}</span>
          </span>
        </div>

        <div className="comp-values-row">
          <span className="comp-curr-val">
            {isScore ? `${current} نقطة` : diffObj.formattedCur}
          </span>
          <span className="comp-arrow">←</span>
          <span className="comp-prev-val">
            {isScore ? `${previous}` : diffObj.formattedPrev}
          </span>
        </div>

        <div className="comp-label">
          {label}
        </div>
      </div>
    );
  };

  return (
    <div className="perf-comparison-box" role="region" aria-label="مقارنة الفحص الحالي بالفحص السابق">
      <div className="perf-comparison-header">
        <div className="title-area">
          <GitCompare size={18} className="text-primary" aria-hidden="true" />
          <h4 className="comp-title">
            مقارنة بالفحص السابق ({strategy === 'mobile' ? 'الجوال' : 'الكمبيوتر'})
          </h4>
        </div>
        <span className="comp-prev-time">
          <Clock size={13} aria-hidden="true" />
          الفحص السابق: {formatPreviousDate(previousScan.createdAt)}
        </span>
      </div>

      <div className="perf-comparison-grid">
        {renderDeltaItem('Performance Score', comparison.score, true)}
        {renderDeltaItem('LCP (سرعة التحميل)', comparison.lcp, false)}
        {renderDeltaItem('CLS (ثبات العناصر)', comparison.cls, false)}
        {renderDeltaItem('FCP (أول ظهور)', comparison.fcp, false)}
        {renderDeltaItem('TTFB (استجابة الخادم)', comparison.ttfb, false)}
      </div>
    </div>
  );
}
