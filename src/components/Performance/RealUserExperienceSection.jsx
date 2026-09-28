import {
  AlertCircle,
  Calendar,
  Monitor,
  Smartphone,
  Users,
} from "lucide-react";
import { Badge, EmptyState } from "../ui/index.js";
import { formatCruxDate } from "../../utils/performance/formatters.js";
import PerfSection from "./PerfSection.jsx";
import RatingBadge from "./RatingBadge.jsx";

const CRUX_METRICS = [
  { key: "lcp", label: "LCP (زمن أكبر محتوى)", desc: "أكبر عنصر في الصفحة" },
  { key: "inp", label: "INP (تفاعل المستخدم)", desc: "استجابة المتجر للنقر" },
  {
    key: "cls",
    label: "CLS (استقرار العناصر)",
    desc: "ثبات التصميم أثناء التحميل",
  },
  { key: "fcp", label: "FCP (أول رسم للمحتوى)", desc: "أول ظهور للعناصر" },
  {
    key: "ttfb",
    label: "TTFB (استجابة السيرفر)",
    desc: "سرعة استجابة خادم المتجر",
  },
];

function CruxCell({ metric }) {
  if (!metric || !metric.hasData) {
    return <span className="perf-muted">—</span>;
  }
  return (
    <div className="perf-crux-cell">
      <span className="perf-crux-value">{metric.displayValue}</span>
      <RatingBadge rating={metric.rating || "unknown"} />
    </div>
  );
}

/**
 * Real-user (CrUX field) data, kept visually separate from lab data.
 */
export default function RealUserExperienceSection({ fieldData }) {
  const hasData = Boolean(fieldData && fieldData.hasData);
  const mobile = fieldData?.mobile || {};
  const desktop = fieldData?.desktop || {};
  const origin = fieldData?.origin || {};
  const period = fieldData?.collectionPeriod;

  return (
    <PerfSection
      icon={Users}
      className="perf-crux"
      ariaLabel="بيانات المستخدمين الفعليين CrUX"
      title={
        <>
          Real User Experience (تجربة المستخدمين الحقيقية){" "}
          <Badge tone="success">Field Data (CrUX)</Badge>
        </>
      }
      description="بيانات واقعية مجمعة من متصفح Google Chrome لزوار متجرك الحقيقيين خلال الـ 28 يوماً الماضية"
      actions={<Badge>المصدر: Chrome User Experience Report (CrUX)</Badge>}
    >
      {!hasData ? (
        <EmptyState
          icon={AlertCircle}
          title="Not enough real-user data available for this origin."
          description={
            <>
              <p>
                لا تتوفر حتى الآن زيارات كافية عبر متصفح Chrome لإنشاء تقرير
                CrUX مخصص لهذا النطاق. سيظهر التقرير تلقائياً بمجرد تجاوز المتجر
                للحد الأدنى من الزيارات المطلوب في شبكة Google.
              </p>
              <p className="perf-crux-note">
                ✓ تم عرض نتائج الفحص المخبري (Lighthouse Lab Data) في الأعلى
                بشكل مستقل.
              </p>
            </>
          }
        />
      ) : (
        <>
          {period && (
            <div className="perf-muted perf-inline-icon perf-crux-period">
              <Calendar size={14} aria-hidden="true" />
              <span>
                فترة جمع البيانات:{" "}
                {formatCruxDate(period.firstDate, "آخر 28 يوماً")} إلى{" "}
                {formatCruxDate(period.lastDate, "اليوم")}
              </span>
            </div>
          )}

          <div className="perf-table-wrap">
            <table
              className="perf-table"
              aria-label="جدول أداء تجربة المستخدمين الحقيقيين"
            >
              <thead>
                <tr>
                  <th scope="col">المؤشر (Metric)</th>
                  <th scope="col">
                    <span className="perf-inline-icon">
                      <Smartphone size={16} aria-hidden="true" />
                      الجوال (Mobile)
                    </span>
                  </th>
                  <th scope="col">
                    <span className="perf-inline-icon">
                      <Monitor size={16} aria-hidden="true" />
                      الكمبيوتر (Desktop)
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {CRUX_METRICS.map(({ key, label, desc }) => (
                  <tr key={key}>
                    <th scope="row">
                      <strong className="perf-crux-metric">{label}</strong>
                      <span className="perf-muted">{desc}</span>
                    </th>
                    <td>
                      <CruxCell metric={mobile[key] || origin[key]} />
                    </td>
                    <td>
                      <CruxCell metric={desktop[key] || origin[key]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PerfSection>
  );
}
