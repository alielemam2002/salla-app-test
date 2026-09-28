import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { Button, Card } from "../ui/index.js";
import { scoreTone } from "../../utils/productEditorForm.js";

function SectionChip({ section }) {
  const Icon = section.isComplete ? CheckCircle2 : AlertCircle;
  return (
    <li
      className={`completion-chip ${section.isComplete ? "is-done" : ""}`}
      title={`${section.label}: ${section.currentScore} / ${section.targetWeight}%`}
    >
      <Icon size={14} aria-hidden="true" className="completion-chip-icon" />
      <span className="completion-chip-label">{section.label}</span>
      <span className="completion-chip-weight">
        {section.currentScore}/{section.targetWeight}%
      </span>
    </li>
  );
}

function MissingItem({ item, onNavigate }) {
  return (
    <li>
      <button
        type="button"
        className="missing-item"
        onClick={() => onNavigate?.(item.fieldId)}
        title={`الانتقال إلى ${item.label} (النسبة المتوقعة بعد الإكمال: ${item.expectedScore}%)`}
      >
        <span className="missing-item-bullet" aria-hidden="true" />
        <span className="missing-item-label">{item.label}</span>
        <span className="missing-item-gain">
          {item.weightGain}
          <span className="missing-item-expected">
            {" "}
            ← {item.expectedScore}%
          </span>
        </span>
        <ArrowLeft
          size={13}
          className="missing-item-arrow"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}

/** Completion score, per-section progress and click-to-jump missing items. */
export default function ProductCompletionCard({
  scoreData,
  onNavigateToField,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  if (!scoreData) return null;

  const { score, sections, remainingItems, isComplete } = scoreData;
  const tone = scoreTone(score);

  return (
    <Card
      className={`product-completion-card completion--${tone}`}
      aria-label="نسبة اكتمال بيانات المنتج"
    >
      <div className="completion-card-header">
        <div className="completion-title-area">
          <span className="completion-icon-badge" aria-hidden="true">
            <Sparkles size={22} />
          </span>
          <div>
            <div className="completion-title-row">
              <h3 className="completion-title">كمّل بيانات منتجك</h3>
              <span className="completion-percentage">{score}%</span>
            </div>
            <p className="completion-subtitle">
              {isComplete
                ? "بيانات منتجك مكتملة بنسبة 100%! منتجك جاهز للظهور بأفضل شكل للعملاء ومحركات البحث."
                : `ينقصك ${remainingItems.length} عنصر لإكمال بيانات منتجك والوصول إلى أفضل تجربة بيع.`}
            </p>
          </div>
        </div>

        {remainingItems.length > 0 && (
          <Button
            size="small"
            variant="ghost"
            icon={isExpanded ? ChevronUp : ChevronDown}
            onClick={() => setIsExpanded((v) => !v)}
            aria-expanded={isExpanded}
          >
            {isExpanded ? "إخفاء التفاصيل" : "عرض النواقص"}
          </Button>
        )}
      </div>

      <div
        className="completion-bar"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="نسبة الاكتمال"
      >
        <div className="completion-bar-fill" style={{ width: `${score}%` }} />
      </div>

      <ul className="completion-chips">
        {Object.values(sections).map((sec) => (
          <SectionChip key={sec.id} section={sec} />
        ))}
      </ul>

      {isExpanded && remainingItems.length > 0 && (
        <div className="completion-missing">
          <div className="completion-missing-title">ينقصك لإكمال 100%:</div>
          <ul className="completion-missing-grid">
            {remainingItems.map((item) => (
              <MissingItem
                key={item.key}
                item={item}
                onNavigate={onNavigateToField}
              />
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
