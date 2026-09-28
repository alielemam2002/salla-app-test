import { useId } from "react";
import { cx } from "./cx.js";

export default function Checkbox({
  checked,
  onChange,
  label,
  id,
  className,
  ...props
}) {
  const autoId = useId();
  const checkboxId = id || autoId;

  return (
    <label className={cx("filter-checkbox", className)} htmlFor={checkboxId}>
      <input
        id={checkboxId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        {...props}
      />
      {label && <span>{label}</span>}
    </label>
  );
}
