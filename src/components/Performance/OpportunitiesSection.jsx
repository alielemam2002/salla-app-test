import { CheckCircle, ListChecks, Sparkles } from "lucide-react";
import { Card, EmptyState, SegmentedTabs } from "../ui/index.js";
import { useRecommendations } from "../../hooks/performance/useRecommendations.js";
import PerfSection from "./PerfSection.jsx";
import RecommendationDetailModal from "./RecommendationDetailModal.jsx";
import {
  RecommendationRow,
  TopOpportunityCard,
} from "./RecommendationItems.jsx";

/** Top opportunities + filterable list of all Lighthouse recommendations. */
export default function OpportunitiesSection({ recommendations = [] }) {
  const {
    categories,
    selectedCategory,
    setSelectedCategory,
    topOpportunities,
    filteredList,
    activeRecommendation,
    openRecommendation,
    closeRecommendation,
  } = useRecommendations(recommendations);

  if (!recommendations || recommendations.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CheckCircle}
          tone="primary"
          title="تهانينا! لم يتم العثور على فرص تحسين معطلة في هذا الفحص."
          description="متجرك يتبع أفضل ممارسات التحميل وفقاً لمعايير Google Lighthouse الحالية."
        />
      </Card>
    );
  }

  return (
    <>
      {topOpportunities.length > 0 && (
        <PerfSection
          icon={Sparkles}
          className="perf-top-opps"
          ariaLabel="أهم أولويات التحسين"
          title="Top Opportunities (أهم أولويات التحسين)"
          description="هذه التوصيات تحقق أكبر أثر إيجابي مباشر على سرعة متجرك وفقاً لبيانات Google Lighthouse"
        >
          <div className="perf-top-grid">
            {topOpportunities.map((rec, index) => (
              <TopOpportunityCard
                key={rec.id}
                rec={rec}
                rank={index + 1}
                onOpen={() => openRecommendation(rec)}
              />
            ))}
          </div>
        </PerfSection>
      )}

      <PerfSection
        icon={ListChecks}
        ariaLabel="جميع التوصيات والتحسينات"
        title="All Recommendations (جميع التوصيات)"
        description={`${filteredList.length} توصية قابلة للتنفيذ تم استخراجها من تدقيق Google`}
      >
        <SegmentedTabs
          variant="pill"
          className="perf-filter-tabs"
          ariaLabel="تصنيف التوصيات"
          tabs={categories.map((cat) => ({
            id: cat.id,
            label: cat.label,
            badge: cat.count,
          }))}
          activeTab={selectedCategory}
          onTabChange={setSelectedCategory}
        />

        <div className="perf-rec-list">
          {filteredList.map((rec) => (
            <RecommendationRow
              key={rec.id}
              rec={rec}
              onOpen={() => openRecommendation(rec)}
            />
          ))}
        </div>
      </PerfSection>

      <RecommendationDetailModal
        recommendation={activeRecommendation}
        onClose={closeRecommendation}
      />
    </>
  );
}
