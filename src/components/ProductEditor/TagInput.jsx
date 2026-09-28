import { useState } from "react";
import { Hash, Plus, X } from "lucide-react";
import { Button, TextInput } from "../ui/index.js";
import { tagName } from "../../utils/productEditorForm.js";

/**
 * Chip input for product tags. Tags are `{ id?, name }`; new ones have no id
 * yet and are created on save (Salla's PUT only accepts tag IDs).
 */
export default function TagInput({ value, onChange, inputId }) {
  const [input, setInput] = useState("");
  const tags = Array.isArray(value)
    ? value.map((t) => (typeof t === "object" ? t : { name: t }))
    : [];

  const add = () => {
    const trimmed = input.trim().replace(/^#/, "");
    if (!trimmed) return;
    if (!tags.some((t) => tagName(t) === trimmed)) {
      onChange([...tags, { name: trimmed }]);
    }
    setInput("");
  };

  const remove = (name) => onChange(tags.filter((t) => tagName(t) !== name));

  return (
    <div className="tag-input">
      <div className="editor-chips" aria-live="polite">
        {tags.length === 0 ? (
          <span className="editor-chips-empty">
            لا توجد وسوم مضافة. أضف وسومًا أدناه:
          </span>
        ) : (
          tags.map((t) => (
            <span key={tagName(t)} className="editor-chip">
              #{tagName(t)}
              <button
                type="button"
                aria-label={`حذف الوسم ${tagName(t)}`}
                onClick={() => remove(tagName(t))}
                className="editor-chip-remove"
              >
                <X size={12} />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="tag-input-bar">
        <TextInput
          id={inputId}
          type="text"
          prefix={<Hash size={14} aria-hidden="true" />}
          placeholder="أدخل وسمًا جديدًا ثم اضغط إضافة أو Enter (مثال: ملابس_صيفية)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button size="small" icon={Plus} onClick={add}>
          إضافة وسم
        </Button>
      </div>
    </div>
  );
}
