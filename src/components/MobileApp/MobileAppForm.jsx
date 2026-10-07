import { useState } from "react";
import {
  Check,
  Globe,
  Lock,
  Palette,
  Play,
  Save,
  ShieldCheck,
  Smartphone,
  UploadCloud,
} from "lucide-react";
import { Button, TextInput } from "../ui/index.js";

const PRESET_COLORS = [
  { name: "زمردي (الأصلي)", hex: "#10B981" },
  { name: "أزرق ملكي", hex: "#2563EB" },
  { name: "بنفسجي فاخر", hex: "#8B5CF6" },
  { name: "ذهبي / كهرماني", hex: "#F59E0B" },
  { name: "وردي ناعم", hex: "#EC4899" },
  { name: "داكن أنيق", hex: "#111827" },
];

export default function MobileAppForm({
  config,
  onChange,
  onSave,
  onBuild,
  saving = false,
  building = false,
}) {
  const [logoInput, setLogoInput] = useState(config.logoUrl || "");

  const handleApplyLogoUrl = (e) => {
    e.preventDefault();
    if (logoInput.trim()) {
      onChange({ ...config, logoUrl: logoInput.trim() });
    }
  };

  return (
    <div className="mobile-app-form-card">
      <div className="form-card-header">
        <div className="form-card-title-group">
          <Smartphone size={22} className="form-title-icon" />
          <div>
            <h3>بيانات وهوية تطبيق الجوال</h3>
            <p>خصص اسم وشعار وألوان تطبيق الأندرويد الخاص بمتجرك</p>
          </div>
        </div>
      </div>

      <div className="form-card-body">
        {/* App Name */}
        <div className="form-group">
          <label className="form-label" htmlFor="app-name-input">
            اسم التطبيق <span className="form-required">*</span>
          </label>
          <TextInput
            id="app-name-input"
            value={config.appName || ""}
            onChange={(e) => onChange({ ...config, appName: e.target.value })}
            placeholder="مثال: متجر نحلة"
            maxLength={40}
          />
          <span className="form-hint">
            الاسم الذي سيظهر تحت أيقونة التطبيق على شاشة هاتف العميل.
          </span>
        </div>

        {/* Storefront URL */}
        <div className="form-group">
          <label className="form-label" htmlFor="store-url-input">
            رابط المتجر في سلة <span className="form-required">*</span>
          </label>
          <div className="store-url-field-locked">
            <TextInput
              id="store-url-input"
              dir="ltr"
              value={config.storeUrl || ""}
              onChange={(e) => onChange({ ...config, storeUrl: e.target.value })}
              placeholder="https://yourstore.com"
              prefix={<Globe size={16} />}
              suffix={
                <span className="verified-badge" title="نطاق معتمد">
                  <Lock size={12} /> معتمد
                </span>
              }
            />
          </div>
          <span className="form-hint">
            الرابط الذي سيفتحه التطبيق مباشرة داخل الـ WebView.
          </span>
        </div>

        {/* Primary Brand Color */}
        <div className="form-group">
          <label className="form-label">
            اللون الرئيسي للهوية <span className="form-required">*</span>
          </label>
          <div className="color-picker-row">
            <div className="color-swatch-input">
              <input
                type="color"
                className="color-picker-native"
                value={config.primaryColor || "#10B981"}
                onChange={(e) =>
                  onChange({ ...config, primaryColor: e.target.value })
                }
              />
              <span className="color-hex-text" dir="ltr">
                {config.primaryColor || "#10B981"}
              </span>
            </div>

            <div className="color-presets-list">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  className={`color-preset-btn ${config.primaryColor === preset.hex ? "active" : ""}`}
                  style={{ backgroundColor: preset.hex }}
                  onClick={() =>
                    onChange({ ...config, primaryColor: preset.hex })
                  }
                  title={preset.name}
                >
                  {config.primaryColor === preset.hex && (
                    <Check size={12} color="#ffffff" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Logo / Icon */}
        <div className="form-group">
          <label className="form-label">شعار وأيقونة التطبيق</label>
          <div className="logo-preview-row">
            {config.logoUrl ? (
              <img
                src={config.logoUrl}
                alt={config.appName}
                className="form-logo-thumb"
              />
            ) : (
              <div
                className="form-logo-placeholder"
                style={{ backgroundColor: config.primaryColor || "#10B981" }}
              >
                <Smartphone size={24} color="#ffffff" />
              </div>
            )}
            <div className="logo-input-action">
              <TextInput
                dir="ltr"
                value={logoInput}
                onChange={(e) => setLogoInput(e.target.value)}
                placeholder="أدخل رابط صورة الشعار (URL)..."
              />
              <Button
                size="small"
                variant="secondary"
                icon={UploadCloud}
                onClick={handleApplyLogoUrl}
              >
                تحديث الشعار
              </Button>
            </div>
          </div>
          <span className="form-hint">
            ينصح باستخدام صورة مربعة بدقة 512x512 بكسل بصيغة PNG.
          </span>
        </div>

        {/* Android Package Name (Read-only / Generated) */}
        <div className="form-group">
          <label className="form-label">معرّف تطبيق الأندرويد (Package ID)</label>
          <div className="package-name-display" dir="ltr">
            <ShieldCheck size={16} className="package-icon" />
            <span>{config.packageName || "sa.salla.app.auto_generated"}</span>
          </div>
          <span className="form-hint">
            معرّف مميز لتطبيقك في نظام أندرويد لضمان عدم التعارض على Google Play.
          </span>
        </div>
      </div>

      {/* Form Action Buttons */}
      <div className="form-card-footer">
        <Button
          variant="secondary"
          icon={Save}
          onClick={onSave}
          loading={saving}
          disabled={building}
        >
          حفظ التعديلات
        </Button>
        <Button
          variant="primary"
          icon={Play}
          onClick={onBuild}
          loading={building}
          className="btn-build-app"
        >
          إنشاء وبناء التطبيق الآن 🚀
        </Button>
      </div>
    </div>
  );
}
