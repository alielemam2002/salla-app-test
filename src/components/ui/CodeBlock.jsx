import { Check, Copy } from "lucide-react";
import { useClipboard } from "../../hooks/ui/useClipboard.js";
import { cx } from "./cx.js";

/** Monospace preformatted block with an optional copy button. */
export default function CodeBlock({
  value,
  copyable = true,
  maxHeight,
  className,
}) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const { copied, copy } = useClipboard();

  return (
    <div className={cx("ui-code", className)}>
      {copyable && (
        <button
          type="button"
          className="ui-code-copy"
          onClick={() => copy(text)}
          aria-label={copied ? "تم النسخ" : "نسخ"}
          title={copied ? "تم النسخ" : "نسخ"}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      )}
      <pre style={maxHeight ? { maxHeight } : undefined}>{text}</pre>
    </div>
  );
}
