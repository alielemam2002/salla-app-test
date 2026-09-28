import { Percent, RotateCcw } from "lucide-react";
import { cx } from "../ui/index.js";

const MODES = [
  { id: "apply", label: "Apply Discount", icon: Percent },
  { id: "remove", label: "Remove Discount", icon: RotateCcw },
];

/** Apply / Remove segmented switch under the modal header. */
export default function DiscountModeToggle({ mode, onChange, disabled }) {
  return (
    <div className="bulk-mode-toggle" role="group" aria-label="Discount action">
      {MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={mode === id}
          className={cx(
            "bulk-mode-btn",
            mode === id && "active",
            mode === id && id === "remove" && "active--remove",
          )}
          onClick={() => onChange(id)}
          disabled={disabled}
        >
          <Icon size={15} aria-hidden="true" /> {label}
        </button>
      ))}
    </div>
  );
}
