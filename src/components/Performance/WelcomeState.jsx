import { Check, Gauge } from "lucide-react";
import { Card, EmptyState } from "../ui/index.js";

const FEATURES = [
  {
    title: "فحص سريع ومستقل للجوال والكمبيوتر",
    desc: "ظهور نتائج سريعة وتحديث تلقائي لجميع الأجهزة دون بطء.",
  },
  {
    title: "مؤشرات Core Web Vitals المحدثة",
    desc: "فحص LCP, INP, CLS, FCP, TTFB بأحدث معايير Google.",
  },
  {
    title: "توصيات دقيقة مع حجم التوفير الفعلي",
    desc: "اكتشاف الصور الضخمة، والسكريبتات المعطلة للعرض، بدون أرقام وهمية.",
  },
  {
    title: "متابعة تطور الأداء عبر الزمن",
    desc: "مخططات بيانية وسجل تاريخي لتتبع سرعة المتجر قبل وبعد التعديلات.",
  },
];

/** First-run view before any scan has been made. */
export default function WelcomeState() {
  return (
    <Card className="perf-welcome">
      <EmptyState
        icon={Gauge}
        tone="primary"
        title="جاهز لفحص متجرك واكتشاف فرص التحسين؟"
        description='أدخل رابط متجرك في الأعلى واضغط على "فحص أداء المتجر" للحصول على تقرير متكامل يشمل:'
      />
      <ul className="perf-welcome-grid">
        {FEATURES.map((f) => (
          <li key={f.title} className="perf-welcome-item">
            <span className="perf-welcome-check" aria-hidden="true">
              <Check size={14} />
            </span>
            <div>
              <strong>{f.title}</strong>
              <span>{f.desc}</span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
