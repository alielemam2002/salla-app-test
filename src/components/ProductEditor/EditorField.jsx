import { Field } from "../ui/index.js";

/**
 * Kit `Field` wrapped in an anchor element (`field-<name>`) so the
 * completion card can scroll to and highlight it.
 */
export default function EditorField({ anchor, className, ...fieldProps }) {
  return (
    <div id={`field-${anchor}`} className={className || "editor-field"}>
      <Field {...fieldProps} />
    </div>
  );
}
