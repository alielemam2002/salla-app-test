import React, { useState, useMemo } from 'react';
import { Zap, ChevronRight, Filter, Sparkles, CheckCircle } from 'lucide-react';
import RecommendationDetailModal from './RecommendationDetailModal.jsx';

/**
 * Filterable Opportunities & Recommendations Section
 */
export default function OpportunitiesSection({ recommendations = [] }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeModalRec, setActiveModalRec] = useState(null);

  const categories = [
    { id: 'all', label: 'الكل' },
    { id: 'images', label: 'الصور' },
    { id: 'javascript', label: 'جافاسكريبت' },
    { id: 'css', label: 'تنسيقات CSS' },
    { id: 'network', label: 'الشبكة والخادم' },
    { id: 'rendering', label: 'العرض (Rendering)' },
    { id: 'layout', label: 'استقرار العناصر' },
    { id: 'fonts', label: 'الخطوط' }
  ];

  // Top high-impact opportunities (up to 3)
  const topOpportunities = useMemo(() => {
    return recommendations
      .filter(r => r.impact === 'high' || r.impact === 'medium')
      .slice(0, 3);
  }, [recommendations]);

  // Filtered list
  const filteredList = useMemo(() => {
    if (selectedCategory === 'all') return recommendations;
    return recommendations.filter(r => r.category === selectedCategory);
  }, [recommendations, selectedCategory]);

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="perf-opps-clean-state" role="status">
        <CheckCircle size={36} className="text-emerald" aria-hidden="true" />
        <h4>تهانينا! لم يتم العثور على فرص تحسين معطلة في هذا الفحص.</h4>
        <p>متجرك يتبع أفضل ممارسات التحميل وفقاً لمعايير Google Lighthouse الحالية.</p>
      </div>
    );
  }

  return (
    <div className="perf-opportunities-section">
      {/* Top Opportunities Highlight Box */}
      {topOpportunities.length > 0 && (
        <div className="perf-top-opps-block" role="region" aria-label="أهم أولويات التحسين">
          <div className="perf-top-opps-header">
            <div className="title-row">
              <Sparkles size={18} className="text-amber" aria-hidden="true" />
              <h3 className="perf-section-title">Top Opportunities (أهم أولويات التحسين)</h3>
            </div>
            <p className="perf-section-subtitle">
              هذه التوصيات تحقق أكبر أثر إيجابي مباشر على سرعة متجرك وفقاً لبيانات Google Lighthouse
            </p>
          </div>

          <div className="perf-top-cards-grid">
            {topOpportunities.map((opp, index) => (
              <div
                key={opp.id}
                className={`perf-top-card impact-${opp.impact}`}
                onClick={() => setActiveModalRec(opp)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveModalRec(opp)}
              >
                <div className="top-card-header">
                  <span className="card-number">#{index + 1}</span>
                  <span className={`perf-impact-badge ${opp.impact}`}>
                    {opp.impact === 'high' ? 'أثر كبير [HIGH]' : 'أثر متوسط [MEDIUM]'}
                  </span>
                  {opp.affectedMetric && (
                    <span className="perf-metric-tag-sm">
                      {opp.affectedMetric}
                    </span>
                  )}
                </div>

                <h4 className="top-card-title">{opp.title}</h4>

                <div className="top-card-savings">
                  {opp.formattedSavingsMs ? (
                    <span className="savings-highlight">
                      توفير محتمل: <strong>{opp.formattedSavingsMs}</strong>
                    </span>
                  ) : opp.formattedSavingsBytes ? (
                    <span className="savings-highlight">
                      توفير محتمل: <strong>{opp.formattedSavingsBytes}</strong>
                    </span>
                  ) : (
                    <span className="savings-available">
                      إمكانية تحسين متاحة
                    </span>
                  )}
                </div>

                <div className="top-card-action">
                  <span>عرض خطوات المعالجة</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Recommendations Table / List */}
      <div className="perf-all-recs-block" role="region" aria-label="جميع التوصيات والتحسينات">
        <div className="perf-all-recs-header">
          <div>
            <h3 className="perf-section-title">All Recommendations (جميع التوصيات)</h3>
            <p className="perf-section-subtitle">
              {filteredList.length} توصية قابلة للتنفيذ تم استخراجها من تدقيق Google
            </p>
          </div>

          {/* Category filters */}
          <div className="perf-cat-filters" role="tablist" aria-label="تصنيف التوصيات">
            {categories.map((cat) => {
              const count = cat.id === 'all'
                ? recommendations.length
                : recommendations.filter(r => r.category === cat.id).length;

              if (cat.id !== 'all' && count === 0) return null;

              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === cat.id}
                  className={`perf-filter-pill ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        <div className="perf-recs-list">
          {filteredList.map((rec) => (
            <div
              key={rec.id}
              className="perf-rec-row"
              onClick={() => setActiveModalRec(rec)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveModalRec(rec)}
            >
              <div className="rec-main-col">
                <div className="rec-meta-row">
                  <span className={`perf-impact-badge ${rec.impact}`}>
                    {rec.impact === 'high' ? 'أثر كبير' : rec.impact === 'medium' ? 'أثر متوسط' : 'أثر منخفض'}
                  </span>
                  {rec.affectedMetric && (
                    <span className="perf-metric-tag-sm">{rec.affectedMetric}</span>
                  )}
                  {rec.categoryLabel && (
                    <span className="perf-cat-tag-sm">{rec.categoryLabel}</span>
                  )}
                </div>
                <h4 className="rec-row-title">{rec.title}</h4>
                <p className="rec-row-desc">{rec.description}</p>
              </div>

              <div className="rec-savings-col">
                {rec.formattedSavingsMs ? (
                  <div className="rec-savings-badge ms">
                    <span>توفير</span>
                    <strong>{rec.formattedSavingsMs}</strong>
                  </div>
                ) : rec.formattedSavingsBytes ? (
                  <div className="rec-savings-badge bytes">
                    <span>توفير</span>
                    <strong>{rec.formattedSavingsBytes}</strong>
                  </div>
                ) : (
                  <span className="rec-savings-neutral">تحسين متاح</span>
                )}
                <ChevronRight size={18} className="rec-chevron" aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Drawer */}
      {activeModalRec && (
        <RecommendationDetailModal
          recommendation={activeModalRec}
          onClose={() => setActiveModalRec(null)}
        />
      )}
    </div>
  );
}
