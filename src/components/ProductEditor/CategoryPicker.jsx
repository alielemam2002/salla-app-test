import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

const MAX_VISIBLE = 15;

/** Searchable multi-select for store categories. `value` is an id array. */
export default function CategoryPicker({ categories = [], value, onChange }) {
  const [query, setQuery] = useState("");
  const selectedIds = Array.isArray(value) ? value : [];

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  const toggle = (id) => {
    const num = Number(id);
    onChange(
      selectedIds.includes(num)
        ? selectedIds.filter((x) => x !== num)
        : [...selectedIds, num],
    );
  };

  return (
    <div className="category-picker">
      <div className="editor-chips" aria-live="polite">
        {selectedIds.length === 0 ? (
          <span className="editor-chips-empty">
            لم يتم اختيار أي تصنيف بعد. اختر تصنيفًا من القائمة أدناه:
          </span>
        ) : (
          selectedIds.map((id) => {
            const cat = categories.find((c) => Number(c.id) === Number(id));
            const label = cat ? cat.name : `تصنيف #${id}`;
            return (
              <span key={id} className="editor-chip editor-chip--primary">
                {label}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="editor-chip-remove"
                  aria-label={`إزالة التصنيف ${label}`}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })
        )}
      </div>

      <div className="category-picker-box">
        <div className="category-picker-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            className="category-search-input"
            placeholder="ابحث في تصنيفات المتجر..."
            aria-label="ابحث في تصنيفات المتجر"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="category-options-grid">
          {filtered.slice(0, MAX_VISIBLE).map((cat) => {
            const checked = selectedIds.includes(Number(cat.id));
            return (
              <label
                key={cat.id}
                className={`category-option ${checked ? "is-checked" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(cat.id)}
                />
                <span>{cat.name}</span>
              </label>
            );
          })}
          {filtered.length === 0 && (
            <div className="category-options-empty">
              لا توجد تصنيفات مطابقة.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
