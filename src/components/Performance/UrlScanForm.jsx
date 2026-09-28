import { Globe, Play } from "lucide-react";
import { Button, SegmentedTabs, TextInput } from "../ui/index.js";

const URL_PRESETS = [
  { id: "homepage", label: "الصفحة الرئيسية (Homepage)" },
  { id: "custom", label: "رابط مخصص (Custom URL)" },
];

/** URL preset switch + store URL input + scan button. */
export default function UrlScanForm({
  url,
  onUrlChange,
  urlType,
  onPresetSelect,
  onSubmit,
  isPending,
  validationError,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="perf-url-form">
      <SegmentedTabs
        variant="pill"
        tabs={URL_PRESETS}
        activeTab={urlType}
        onTabChange={onPresetSelect}
        ariaLabel="نوع الصفحة المراد فحصها"
      />

      <form onSubmit={handleSubmit} className="perf-url-row" noValidate>
        <div className="perf-url-field">
          <TextInput
            id="perf-store-url"
            type="text"
            aria-label="رابط المتجر المراد فحصه"
            aria-invalid={validationError ? true : undefined}
            aria-describedby={validationError ? "perf-url-error" : undefined}
            placeholder="https://yourstore.salla.sa"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            disabled={isPending}
            invalid={Boolean(validationError)}
            prefix={<Globe size={16} aria-hidden="true" />}
            dir="ltr"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          id="run-performance-test-btn"
          className="perf-url-submit"
          icon={Play}
          loading={isPending}
          disabled={!url.trim()}
        >
          {isPending ? "جاري الفحص..." : "فحص أداء المتجر"}
        </Button>
      </form>

      {validationError && (
        <p id="perf-url-error" className="form-error-msg" role="alert">
          {validationError}
        </p>
      )}
    </div>
  );
}
