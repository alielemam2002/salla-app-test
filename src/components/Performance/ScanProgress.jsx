import { CheckCircle2, Circle } from "lucide-react";
import { Card, Spinner, cx } from "../ui/index.js";
import { getStrategyLabel } from "../../utils/performance/formatters.js";

const STEPS = [
  { id: "preparing", label: "التحقق من صحة الرابط والاتصال بنطاق المتجر" },
  {
    id: "fetching",
    label: "تشغيل محرك Lighthouse لقياس Core Web Vitals وتوليد التوصيات",
  },
  {
    id: "crux",
    label: "استرداد بيانات المستخدمين الواقعية من Chrome UX Report (CrUX)",
  },
];

/** 'done' | 'active' | 'pending' for each step given the current scan step. */
function stepState(stepId, scanStep) {
  if (stepId === "preparing")
    return scanStep === "preparing" ? "active" : "done";
  if (stepId === "fetching") {
    if (scanStep === "fetching") return "active";
    return scanStep === "preparing" ? "pending" : "done";
  }
  return "pending";
}

/** Live multi-step status while a scan is running (no fake percentages). */
export default function ScanProgress({ scanStep, strategy }) {
  return (
    <Card className="perf-progress" role="status" aria-live="polite">
      <div className="perf-progress-head">
        <Spinner size={20} />
        <h3 className="perf-progress-title">
          جاري فحص سرعة المتجر لنسخة {getStrategyLabel(strategy)}...
        </h3>
      </div>
      <p className="perf-muted">
        يتم فحص المتجر عبر محرك Lighthouse Lab Data الرسمي من Google لاستخراج
        درجات السرعة وتوصيات التحسين.
      </p>

      <ol className="perf-progress-steps">
        {STEPS.map((step) => {
          const state = stepState(step.id, scanStep);
          return (
            <li
              key={step.id}
              className={cx("perf-progress-step", `is-${state}`)}
            >
              {state === "done" ? (
                <CheckCircle2 size={16} aria-hidden="true" />
              ) : state === "active" ? (
                <Spinner size={16} />
              ) : (
                <Circle size={16} aria-hidden="true" />
              )}
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
