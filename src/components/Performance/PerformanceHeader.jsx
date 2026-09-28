import { Gauge, Key } from "lucide-react";
import { Badge, Button, Card } from "../ui/index.js";

/** Page intro with the API-key shortcut; the scan form goes in `children`. */
export default function PerformanceHeader({
  hasApiKey,
  onOpenApiKey,
  children,
}) {
  return (
    <Card className="perf-header">
      <div className="perf-header-top">
        <Badge tone="primary" icon={Gauge}>
          Google PageSpeed &amp; CrUX Intelligence
        </Badge>

        <Button
          size="small"
          variant="ghost"
          icon={Key}
          onClick={onOpenApiKey}
          aria-label="إعداد مفتاح Google API"
        >
          <span>Google API Key</span>
          <span
            className={`perf-key-dot ${hasApiKey ? "is-on" : ""}`}
            title={hasApiKey ? "المفتاح مفعل" : "مفتاح اختياري"}
          />
        </Button>
      </div>

      <div className="perf-header-text">
        <h1 className="perf-title">Performance Center (مركز أداء المتجر)</h1>
        <p className="perf-subtitle">
          قياس سرعة متجرك الحقيقية بدقة عبر محركات Google، وتشخيص أسباب البطء،
          وتتبع مؤشرات Core Web Vitals بدقة.
        </p>
      </div>

      {children}
    </Card>
  );
}
