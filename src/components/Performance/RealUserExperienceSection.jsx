import React from 'react';
import { Users, AlertCircle, Smartphone, Monitor, CheckCircle, Calendar } from 'lucide-react';
import { getRatingLabel } from '../../utils/performance/thresholds.js';

/**
 * Real User Experience (CrUX) Section
 * Strictly separated from Lab Data. Shows real user data from Google Chrome UX Report
 */
export default function RealUserExperienceSection({ fieldData }) {
  const hasData = Boolean(fieldData && fieldData.hasData);
  const mobile = fieldData?.mobile || {};
  const desktop = fieldData?.desktop || {};
  const origin = fieldData?.origin || {};

  const metrics = [
    { key: 'lcp', label: 'LCP (زمن أكبر محتوى)', desc: 'أكبر عنصر في الصفحة' },
    { key: 'inp', label: 'INP (تفاعل المستخدم)', desc: 'استجابة المتجر للنقر' },
    { key: 'cls', label: 'CLS (استقرار العناصر)', desc: 'ثبات التصميم أثناء التحميل' },
    { key: 'fcp', label: 'FCP (أول رسم للمحتوى)', desc: 'أول ظهور للعناصر' },
    { key: 'ttfb', label: 'TTFB (استجابة السيرفر)', desc: 'سرعة استجابة خادم المتجر' },
  ];

  const getMetricObj = (source, key) => {
    return source?.[key] || null;
  };

  const renderBadge = (metric) => {
    if (!metric || !metric.hasData) return <span className="crux-val-na">—</span>;
    const rating = metric.rating || 'unknown';
    const ratingLabel = getRatingLabel(rating);

    return (
      <div className="crux-cell">
        <span className="crux-val">{metric.displayValue}</span>
        <span className={`perf-metric-pill small ${rating}`}>
          {ratingLabel}
        </span>
      </div>
    );
  };

  return (
    <div className="perf-crux-section" role="region" aria-label="بيانات المستخدمين الفعليين CrUX">
      <div className="perf-section-header">
        <div>
          <div className="perf-title-with-badge">
            <h3 className="perf-section-title">
              <Users size={20} className="perf-icon-title" aria-hidden="true" />
              Real User Experience (تجربة المستخدمين الحقيقية)
            </h3>
            <span className="perf-tag-field">Field Data (CrUX)</span>
          </div>
          <p className="perf-section-subtitle">
            بيانات واقعية مجمعة من متصفح Google Chrome لزوار متجرك الحقيقيين خلال الـ 28 يوماً الماضية
          </p>
        </div>
        <span className="perf-source-badge field">
          المصدر: Chrome User Experience Report (CrUX)
        </span>
      </div>

      {!hasData ? (
        <div className="perf-crux-empty" role="status">
          <AlertCircle size={32} className="perf-empty-icon" aria-hidden="true" />
          <div className="perf-empty-content">
            <h4 className="perf-empty-title">
              Not enough real-user data available for this origin.
            </h4>
            <p className="perf-empty-desc">
              لا تتوفر حتى الآن زيارات كافية عبر متصفح Chrome لإنشاء تقرير CrUX مخصص لهذا النطاق.
              سيظهر التقرير تلقائياً بمجرد تجاوز المتجر للحد الأدنى من الزيارات المطلوب في شبكة Google.
            </p>
            <span className="perf-empty-notice">
              ✓ تم عرض نتائج الفحص المخبري (Lighthouse Lab Data) في الأعلى بشكل مستقل.
            </span>
          </div>
        </div>
      ) : (
        <div className="perf-crux-table-container">
          {fieldData.collectionPeriod && (
            <div className="crux-period-bar">
              <Calendar size={14} aria-hidden="true" />
              <span>
                فترة جمع البيانات: {fieldData.collectionPeriod.firstDate ? `${fieldData.collectionPeriod.firstDate.year}/${fieldData.collectionPeriod.firstDate.month}/${fieldData.collectionPeriod.firstDate.day}` : 'آخر 28 يوماً'}
                {' '}إلى{' '}
                {fieldData.collectionPeriod.lastDate ? `${fieldData.collectionPeriod.lastDate.year}/${fieldData.collectionPeriod.lastDate.month}/${fieldData.collectionPeriod.lastDate.day}` : 'اليوم'}
              </span>
            </div>
          )}

          <table className="perf-crux-table" aria-label="جدول أداء تجربة المستخدمين الحقيقيين">
            <thead>
              <tr>
                <th scope="col" className="col-metric">المؤشر (Metric)</th>
                <th scope="col" className="col-device">
                  <div className="th-device">
                    <Smartphone size={16} aria-hidden="true" />
                    <span>الجوال (Mobile)</span>
                  </div>
                </th>
                <th scope="col" className="col-device">
                  <div className="th-device">
                    <Monitor size={16} aria-hidden="true" />
                    <span>الكمبيوتر (Desktop)</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(({ key, label, desc }) => {
                const mobVal = getMetricObj(mobile, key) || getMetricObj(origin, key);
                const deskVal = getMetricObj(desktop, key) || getMetricObj(origin, key);

                return (
                  <tr key={key}>
                    <td className="metric-info-cell">
                      <strong className="metric-title">{label}</strong>
                      <span className="metric-sub">{desc}</span>
                    </td>
                    <td>{renderBadge(mobVal)}</td>
                    <td>{renderBadge(deskVal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
