import { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowLeft,
} from "lucide-react";

export default function ProductCompletionCard({
  scoreData,
  onNavigateToField,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!scoreData) return null;

  const { score, sections, remainingItems, isComplete } = scoreData;

  const getScoreColor = (val) => {
    if (val >= 80) return "var(--score-high, #10b981)";
    if (val >= 50) return "var(--score-mid, #f59e0b)";
    return "var(--score-low, #ef4444)";
  };

  const scoreColor = getScoreColor(score);

  return (
    <div className="product-completion-card">
      <div className="completion-card-header">
        <div className="completion-title-area">
          <div className="completion-icon-badge" style={{ color: scoreColor }}>
            <Sparkles size={22} />
          </div>
          <div>
            <div className="completion-title-row">
              <h3 className="completion-title">كمّل بيانات منتجك</h3>
              <span
                className="completion-percentage-badge"
                style={{
                  backgroundColor: `${scoreColor}15`,
                  color: scoreColor,
                  borderColor: `${scoreColor}40`,
                }}
              >
                {score}%
              </span>
            </div>
            <p className="completion-subtitle">
              {isComplete
                ? "بيانات منتجك مكتملة بنسبة 100%! منتجك جاهز للظهور بأفضل شكل للعملاء ومحركات البحث."
                : `ينقصك ${remainingItems.length} عنصر لإكمال بيانات منتجك والوصول إلى أفضل تجربة بيع.`}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="completion-toggle-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          <span>{isExpanded ? "إخفاء التفاصيل" : "عرض النواقص"}</span>
        </button>
      </div>

      {/* Dynamic Animated Progress Bar */}
      <div className="completion-bar-container">
        <div
          className="completion-bar-fill"
          style={{
            width: `${score}%`,
            backgroundColor: scoreColor,
            boxShadow: `0 0 12px ${scoreColor}60`,
          }}
        />
      </div>

      {/* Section Weights & Badges */}
      <div className="completion-sections-chips">
        {Object.values(sections).map((sec) => (
          <div
            key={sec.id}
            className={`completion-chip ${sec.isComplete ? "completion-chip--done" : "completion-chip--pending"}`}
            title={`${sec.label}: ${sec.currentScore} / ${sec.targetWeight}%`}
          >
            {sec.isComplete ? (
              <CheckCircle2 size={14} className="chip-icon chip-icon--done" />
            ) : (
              <AlertCircle size={14} className="chip-icon chip-icon--pending" />
            )}
            <span className="chip-label">{sec.label}</span>
            <span className="chip-weight">
              {sec.currentScore}/{sec.targetWeight}%
            </span>
          </div>
        ))}
      </div>

      {/* Expandable Missing Items List with Click-to-Jump */}
      {isExpanded && remainingItems.length > 0 && (
        <div className="completion-missing-list">
          <div className="missing-list-title">ينقصك لإكمال 100%:</div>
          <div className="missing-items-grid">
            {remainingItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className="missing-item-btn"
                onClick={() => onNavigateToField?.(item.fieldId)}
                title={`الانتقال إلى ${item.label} (النسبة المتوقعة بعد الإكمال: ${item.expectedScore}%)`}
              >
                <div className="missing-item-bullet" />
                <span className="missing-item-label">{item.label}</span>
                <span className="missing-item-gain">
                  {item.weightGain}
                  <span className="missing-item-expected">
                    {" "}← {item.expectedScore}%
                  </span>
                </span>
                <ArrowLeft size={13} className="missing-item-arrow" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
