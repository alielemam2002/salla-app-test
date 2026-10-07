import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Button } from "../ui/index.js";

const STEPS = [
  { id: 1, title: "فحص وتأمين بيانات المتجر والرابط", done: true },
  { id: 2, title: "تهيئة بيئة عمل الأندرويد وحقن الإعدادات", done: true },
  { id: 3, title: "بناء وتجميع حزمة React Native & Gradle", active: true },
  { id: 4, title: "توقيع التطبيق بشهادة رقمية آمنة (Keystore)" },
  { id: 5, title: "إنشاء حزم APK و AAB وتجهيز روابط التحميل" },
];

export default function MobileAppBuildProgress({
  appName = "متجر سلة",
  buildId = "",
  startedAt = Date.now(),
  onCancel,
  cancelling = false,
}) {
  return (
    <div className="mobile-build-progress-card">
      <div className="build-progress-header">
        <div className="build-spinner-circle">
          <Loader2 size={32} className="spin-animation" />
        </div>
        <div className="build-header-text">
          <h3>جاري إنشاء وتجميع تطبيق {appName}...</h3>
          <p>
            يقوم النظام الآن بتوليد كود الأندرويد وبناء حزمتي APK و AAB بالكامل
          </p>
        </div>
      </div>

      {/* Stepper list */}
      <div className="build-stepper-list">
        {STEPS.map((step) => (
          <div
            key={step.id}
            className={`stepper-item ${step.done ? "done" : ""} ${step.active ? "active" : ""}`}
          >
            <div className="stepper-indicator">
              {step.done ? (
                <CheckCircle2 size={18} className="step-icon-done" />
              ) : step.active ? (
                <Loader2 size={16} className="spin-animation step-icon-active" />
              ) : (
                <span className="step-number">{step.id}</span>
              )}
            </div>
            <div className="stepper-content">
              <span className="step-title">{step.title}</span>
              {step.active && (
                <span className="step-hint">جاري المعالجة السحابية...</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Notice & Cancel */}
      <div className="build-progress-footer">
        <div className="build-time-notice">
          <Clock size={16} />
          <span>
            تستغرق عملية البناء والتوقيع عادة بين <strong>2 إلى 4 دقائق</strong>.
            يمكنك إبقاء هذه الصفحة مفتوحة وسنُشعرك فور الجاهزية.
          </span>
        </div>
        {onCancel && (
          <Button
            variant="ghost"
            icon={XCircle}
            onClick={onCancel}
            loading={cancelling}
          >
            إلغاء العملية
          </Button>
        )}
      </div>
    </div>
  );
}
