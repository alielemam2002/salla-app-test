import { cloneElement, forwardRef, isValidElement, useId } from "react";
import { cx } from "./cx.js";

/**
 * Label + control + hint/error wrapper. The single child control receives
 * `id`, `aria-invalid` and `aria-describedby` automatically.
 */
export function Field({
  label,
  required,
  hint,
  error,
  htmlFor,
  labelExtra,
  className,
  children,
}) {
  const autoId = useId();
  const controlId = htmlFor || children?.props?.id || autoId;
  const messageId = `${controlId}-msg`;
  const hasMessage = Boolean(error || hint);

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: controlId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": hasMessage ? messageId : undefined,
      })
    : children;

  return (
    <div className={cx("form-group", className)}>
      {label && (
        <div className="form-label-row">
          <label className="form-label" htmlFor={controlId}>
            {label}
            {required && <span className="form-required">*</span>}
          </label>
          {labelExtra}
        </div>
      )}
      {control}
      {error ? (
        <span id={messageId} className="form-error-msg">
          {error}
        </span>
      ) : hint ? (
        <span id={messageId} className="form-hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef(function TextInput(
  { invalid, className, prefix, suffix, ...props },
  ref,
) {
  const input = (
    <input
      ref={ref}
      className={cx("form-input", invalid && "form-input--error", className)}
      {...props}
    />
  );
  if (!prefix && !suffix) return input;
  return (
    <div className="ui-input-affix">
      {prefix && <span className="ui-input-affix-item">{prefix}</span>}
      {input}
      {suffix && <span className="ui-input-affix-item">{suffix}</span>}
    </div>
  );
});

export const Select = forwardRef(function Select(
  { invalid, className, options, placeholder, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cx("form-select", invalid && "form-input--error", className)}
      {...props}
    >
      {placeholder != null && <option value="">{placeholder}</option>}
      {options
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  );
});

export const Textarea = forwardRef(function Textarea(
  { invalid, className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cx("form-textarea", invalid && "form-input--error", className)}
      {...props}
    />
  );
});

/** Responsive grid for side-by-side fields. columns: 2 | 3 */
export function FormRow({ columns = 2, className, children }) {
  return (
    <div className={cx("form-row", columns === 3 && "form-row--3", className)}>
      {children}
    </div>
  );
}
