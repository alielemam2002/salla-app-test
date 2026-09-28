import React from 'react';
import { Smartphone, Monitor, ShieldCheck, Clock, Loader2, Play } from 'lucide-react';
import { getScoreRating, getRatingLabel } from '../../utils/performance/thresholds.js';

/**
 * Hero Score Card displaying Lighthouse Performance Score and Device Strategy Switcher
 */
export default function PerformanceScoreCard({
  report,
  selectedStrategy,
  onSelectStrategy,
  isDesktopScanning = false,
  isMobileScanning = false,
  onRunStrategy = null
}) {
  if (!report) return null;

  const currentDev = report[selectedStrategy] || {};
  const mobileScore = report.mobile?.score;
  const desktopScore = report.desktop?.score;
  const currentScore = currentDev.score;

  const scoreRating = getScoreRating(currentScore);
  const ratingLabel = getRatingLabel(scoreRating);

  // Score color ring calculation
  const strokeDashoffset = currentScore !== null
    ? 283 - (283 * Math.min(100, Math.max(0, currentScore))) / 100
    : 283;

  const getScoreColor = (rating) => {
    switch (rating) {
      case 'good':
        return '#00875a'; // Web Vitals Green
      case 'needs-improvement':
        return '#d97706'; // Amber / Orange
      case 'poor':
        return '#e11d48'; // Red
      default:
        return '#94a3b8';
    }
  };

  const currentColor = getScoreColor(scoreRating);

  const formatRelativeTime = (isoString) => {
    if (!isoString) return '';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'الآن';
      if (mins === 1) return 'منذ دقيقة واحدة';
      if (mins < 60) return `منذ ${mins} دقيقة`;
      const hours = Math.floor(mins / 60);
      if (hours === 1) return 'منذ ساعة واحدة';
      if (hours < 24) return `منذ ${hours} ساعة`;
      return new Date(isoString).toLocaleDateString('ar-SA');
    } catch {
      return '';
    }
  };

  return (
    <div className="perf-hero-card" role="region" aria-label="تقييم الأداء العام">
      <div className="perf-hero-top">
        <div className="perf-hero-meta">
          <span className="perf-tag-lab">
            <ShieldCheck size={14} aria-hidden="true" />
            بيانات الفحص المخبري (Lighthouse Lab Data)
          </span>
          {currentDev.testedAt && (
            <span className="perf-tested-time">
              <Clock size={13} aria-hidden="true" />
              آخر فحص: {formatRelativeTime(currentDev.testedAt)}
            </span>
          )}
        </div>

        {/* Strategy switcher tabs */}
        <div className="perf-device-switcher" role="tablist" aria-label="نوع الجهاز">
          <button
            type="button"
            role="tab"
            aria-selected={selectedStrategy === 'mobile'}
            className={`perf-device-btn ${selectedStrategy === 'mobile' ? 'active' : ''}`}
            onClick={() => onSelectStrategy('mobile')}
          >
            <Smartphone size={16} aria-hidden="true" />
            <span>جوال (Mobile)</span>
            {isMobileScanning ? (
              <span className="perf-device-badge scanning">
                <Loader2 size={12} className="spin" />
              </span>
            ) : mobileScore !== null && mobileScore !== undefined ? (
              <span className={`perf-device-badge ${getScoreRating(mobileScore)}`}>
                {mobileScore}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={selectedStrategy === 'desktop'}
            className={`perf-device-btn ${selectedStrategy === 'desktop' ? 'active' : ''}`}
            onClick={() => onSelectStrategy('desktop')}
          >
            <Monitor size={16} aria-hidden="true" />
            <span>كمبيوتر (Desktop)</span>
            {isDesktopScanning ? (
              <span className="perf-device-badge scanning">
                <Loader2 size={12} className="spin" />
                <span>جاري الفحص...</span>
              </span>
            ) : desktopScore !== null && desktopScore !== undefined ? (
              <span className={`perf-device-badge ${getScoreRating(desktopScore)}`}>
                {desktopScore}
              </span>
            ) : (
              <span className="perf-device-badge pending">
                غير مفحوص
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="perf-hero-body">
        {/* Big Circular Score Gauge */}
        <div className="perf-gauge-wrapper">
          <svg className="perf-gauge-svg" viewBox="0 0 100 100" width="130" height="130" aria-hidden="true">
            <circle
              className="perf-gauge-bg"
              cx="50"
              cy="50"
              r="45"
            />
            <circle
              className="perf-gauge-progress"
              cx="50"
              cy="50"
              r="45"
              style={{
                strokeDasharray: 283,
                strokeDashoffset: currentScore !== null ? strokeDashoffset : 283,
                stroke: currentColor
              }}
            />
          </svg>
          <div className="perf-gauge-content">
            <span className="perf-gauge-value" style={{ color: currentColor }}>
              {currentScore !== null ? currentScore : '—'}
            </span>
            <span className="perf-gauge-max">/ 100</span>
          </div>
        </div>

        {/* Score Details */}
        <div className="perf-hero-info">
          <div className="perf-score-title-row">
            <h2 className="perf-score-heading">
              Google Performance Score ({selectedStrategy === 'mobile' ? 'الجوال' : 'الكمبيوتر'})
            </h2>
            {currentScore !== null && (
              <span className={`perf-rating-pill ${scoreRating}`}>
                {ratingLabel}
              </span>
            )}
          </div>

          {currentScore !== null ? (
            <>
              <p className="perf-score-desc">
                {scoreRating === 'good' && 'أداء المتجر ممتاز ومتوافق مع أعلى معايير تجربة المستخدم لعام 2026.'}
                {scoreRating === 'needs-improvement' && 'أداء المتجر مقبول، ولكن هناك فرص لتحسين سرعة التحميل وتجربة التصفح.'}
                {scoreRating === 'poor' && 'المتجر يواجه بطئاً ملحوظاً يؤثر على مبيعاتك وتجربة العملاء.'}
              </p>

              <div className="perf-score-legend">
                <span className="legend-item"><span className="dot dot-good"></span> 90-100 جيد</span>
                <span className="legend-item"><span className="dot dot-warn"></span> 50-89 يحتاج تحسين</span>
                <span className="legend-item"><span className="dot dot-poor"></span> 0-49 ضعيف</span>
              </div>
            </>
          ) : isDesktopScanning || isMobileScanning ? (
            <p className="perf-score-desc perf-scanning-hint">
              <Loader2 size={16} className="spin text-primary" />
              جاري قياس أداء هذا الجهاز حالياً عبر خوادم Google...
            </p>
          ) : (
            <div className="perf-device-untested-block">
              <p className="perf-score-desc">
                لم يتم إجراء فحص لنسخة {selectedStrategy === 'mobile' ? 'الجوال' : 'الكمبيوتر'} بعد.
              </p>
              {onRunStrategy && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm mt-2"
                  onClick={() => onRunStrategy(selectedStrategy)}
                >
                  <Play size={14} />
                  <span>فحص {selectedStrategy === 'mobile' ? 'الجوال' : 'الكمبيوتر'} الآن</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
