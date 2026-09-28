import { Key, RotateCw } from "lucide-react";
import { Alert, Button } from "../ui/index.js";

const FALLBACK_MESSAGE =
  "واجهت خدمة Google صعوبة في الوصول للمتجر. يرجى التأكد من أن المتجر متاح للعامة والمحاولة مرة أخرى.";

/** Scan failure with shortcuts to add an API key or retry. */
export default function ScanErrorBanner({ message, onOpenApiKey, onRetry }) {
  return (
    <Alert
      tone="error"
      title="تعذر إكمال فحص الأداء"
      className="perf-error"
      action={
        <div className="perf-error-actions">
          <Button
            size="small"
            variant="secondary"
            icon={Key}
            onClick={onOpenApiKey}
          >
            إدخال Google API Key
          </Button>
          <Button
            size="small"
            variant="secondary"
            icon={RotateCw}
            onClick={onRetry}
          >
            إعادة المحاولة
          </Button>
        </div>
      }
    >
      {message || FALLBACK_MESSAGE}
    </Alert>
  );
}
