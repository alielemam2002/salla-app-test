import { Loader2 } from "lucide-react";
import { cx } from "./cx.js";

export default function Spinner({ size = 16, label, className }) {
  return (
    <span className={cx("ui-spinner", className)} role="status">
      <Loader2 size={size} className="ui-spin" aria-hidden="true" />
      {label ? (
        <span className="ui-spinner-label">{label}</span>
      ) : (
        <span className="sr-only">جارٍ التحميل…</span>
      )}
    </span>
  );
}
