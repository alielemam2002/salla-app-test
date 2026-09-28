import { Clock, Monitor, Play, ShieldCheck, Smartphone } from "lucide-react";
import { Badge, Button, Card, SegmentedTabs, Spinner } from "../ui/index.js";
import { getScoreRating } from "../../utils/performance/thresholds.js";
import {
  formatRelativeTime,
  getStrategyLabel,
} from "../../utils/performance/formatters.js";
import RatingBadge from "./RatingBadge.jsx";
import ScoreGauge from "./ScoreGauge.jsx";

const SCORE_DESCRIPTIONS = {
  good: "أداء المتجر ممتاز ومتوافق مع أعلى معايير تجربة المستخدم لعام 2026.",
  "needs-improvement":
    "أداء المتجر مقبول، ولكن هناك فرص لتحسين سرعة التحميل وتجربة التصفح.",
  poor: "المتجر يواجه بطئاً ملحوظاً يؤثر على مبيعاتك وتجربة العملاء.",
};

function DeviceBadge({ score, scanning, showPending, scanningText }) {
  if (scanning) {
    return (
      <span className="perf-device-scanning">
        <Spinner size={12} />
        {scanningText && <span>{scanningText}</span>}
      </span>
    );
  }
  if (score !== null && score !== undefined) {
    return <RatingBadge rating={getScoreRating(score)}>{score}</RatingBadge>;
  }
  return showPending ? <Badge>غير مفحوص</Badge> : null;
}

/**
 * Hero card: Lighthouse score gauge plus the mobile/desktop switcher.
 */
export default function PerformanceScoreCard({
  report,
  selectedStrategy,
  onSelectStrategy,
  isDesktopScanning = false,
  isMobileScanning = false,
  onRunStrategy = null,
}) {
  if (!report) return null;

  const currentDev = report[selectedStrategy] || {};
  const currentScore = currentDev.score;
  const hasScore = currentScore !== null && currentScore !== undefined;
  const scoreRating = getScoreRating(currentScore);
  const deviceLabel = getStrategyLabel(selectedStrategy);

  const tabs = [
    {
      id: "mobile",
      label: "جوال (Mobile)",
      icon: Smartphone,
      badge: (
        <DeviceBadge score={report.mobile?.score} scanning={isMobileScanning} />
      ),
    },
    {
      id: "desktop",
      label: "كمبيوتر (Desktop)",
      icon: Monitor,
      badge: (
        <DeviceBadge
          score={report.desktop?.score}
          scanning={isDesktopScanning}
          scanningText="جاري الفحص..."
          showPending
        />
      ),
    },
  ];

  return (
    <Card className="perf-hero" aria-label="تقييم الأداء العام">
      <div className="perf-hero-top">
        <div className="perf-hero-meta">
          <Badge tone="info" icon={ShieldCheck}>
            بيانات الفحص المخبري (Lighthouse Lab Data)
          </Badge>
          {currentDev.testedAt && (
            <span className="perf-muted perf-inline-icon">
              <Clock size={13} aria-hidden="true" />
              آخر فحص: {formatRelativeTime(currentDev.testedAt)}
            </span>
          )}
        </div>

        <SegmentedTabs
          variant="pill"
          className="perf-device-tabs"
          tabs={tabs}
          activeTab={selectedStrategy}
          onTabChange={onSelectStrategy}
          ariaLabel="نوع الجهاز"
        />
      </div>

      <div className="perf-hero-body">
        <ScoreGauge
          score={hasScore ? currentScore : null}
          label={`Performance Score (${deviceLabel})`}
        />

        <div className="perf-hero-info">
          <div className="perf-hero-title-row">
            <h2 className="perf-hero-title">
              Google Performance Score ({deviceLabel})
            </h2>
            {hasScore && <RatingBadge rating={scoreRating} />}
          </div>

          {hasScore ? (
            <>
              <p className="perf-muted">{SCORE_DESCRIPTIONS[scoreRating]}</p>
              <ul className="perf-legend" aria-label="مفتاح الألوان">
                <li>
                  <span className="perf-dot perf-dot--good" /> 90-100 جيد
                </li>
                <li>
                  <span className="perf-dot perf-dot--needs-improvement" />{" "}
                  50-89 يحتاج تحسين
                </li>
                <li>
                  <span className="perf-dot perf-dot--poor" /> 0-49 ضعيف
                </li>
              </ul>
            </>
          ) : isDesktopScanning || isMobileScanning ? (
            <Spinner label="جاري قياس أداء هذا الجهاز حالياً عبر خوادم Google..." />
          ) : (
            <div className="perf-untested">
              <p className="perf-muted">
                لم يتم إجراء فحص لنسخة {deviceLabel} بعد.
              </p>
              {onRunStrategy && (
                <Button
                  size="small"
                  variant="primary"
                  icon={Play}
                  onClick={() => onRunStrategy(selectedStrategy)}
                >
                  فحص {deviceLabel} الآن
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
