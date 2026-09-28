import { useId } from "react";
import { cx } from "./cx.js";

/** Accessible on/off toggle (role="switch"). */
export default function Switch({
  checked,
  onChange,
  label,
  description,
  id,
  disabled,
  className,
}) {
  const autoId = useId();
  const switchId = id || autoId;

  return (
    <label
      className={cx("ui-switch", disabled && "is-disabled", className)}
      htmlFor={switchId}
    >
      <span className="ui-switch-text">
        {label && <span className="ui-switch-label">{label}</span>}
        {description && <span className="ui-switch-desc">{description}</span>}
      </span>
      <input
        id={switchId}
        type="checkbox"
        role="switch"
        className="ui-switch-input"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ui-switch-track" aria-hidden="true">
        <span className="ui-switch-thumb" />
      </span>
    </label>
  );
}
