import { useState } from "react";
import { Controller } from "react-hook-form";
import { Info, CheckCircle2, AlertCircle, Save, Loader2, Tag } from "lucide-react";
import Button from "../forms/Button.jsx";

export default function BasicInfoSection({
  control,
  register,
  errors,
  sectionScore,
  categories = [],
  brands = [],
  onSaveSection,
  isSaving,
}) {
  const [catSearch, setCatSearch] = useState("");

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(catSearch.toLowerCase()),
  );

  return (
    <div className="editor-section-card" id="section-basicInfo">
      <div className="editor-section-header">
        <div className="section-header-title">
          <div className="section-header-icon">
            <Info size={18} />
          </div>
          <div>
            <h4 className="section-title">المعلومات الأساسية</h4>
            <span className="section-desc">
              اسم المنتج، الوصف، التصنيفات، والعلامة التجارية.
            </span>
          </div>
        </div>

        <div className="section-header-meta">
          <span
            className={`section-score-pill ${sectionScore?.isComplete ? "section-score-pill--done" : ""}`}
          >
            {sectionScore?.isComplete ? (
              <CheckCircle2 size={13} />
            ) : (
              <AlertCircle size={13} />
            )}
            {sectionScore?.currentScore || 0}/{sectionScore?.targetWeight || 20}%
          </span>

          <Button
            size="small"
            variant="secondary"
            onClick={onSaveSection}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
            حفظ القسم
          </Button>
        </div>
      </div>

      <div className="editor-section-body">
        {/* Product Name */}
        <div className="form-group" id="field-name">
          <label className="form-label required">اسم المنتج</label>
          <input
            type="text"
            className={`form-input ${errors?.name ? "form-input--error" : ""}`}
            placeholder="مثال: قميص قطني كلاسيكي"
            {...register("name", { required: "اسم المنتج مطلوب" })}
          />
          {errors?.name && (
            <span className="form-error-msg">{errors.name.message}</span>
          )}
        </div>

        {/* Description */}
        <div className="form-group" id="field-description">
          <label className="form-label required">وصف المنتج</label>
          <textarea
            rows={4}
            className={`form-textarea ${errors?.description ? "form-textarea--error" : ""}`}
            placeholder="أدخل وصفًا تفصيليًا وجذابًا للمنتج ومميزاته ومواصفاته..."
            {...register("description")}
          />
          <span className="form-hint">
            الوصف الغني بالمعلومات يرفع معدل المبيعات ويحسن ظهور المنتج في محركات البحث.
          </span>
        </div>

        {/* Categories Selection */}
        <div className="form-group" id="field-categories">
          <label className="form-label">
            <Tag size={14} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
            تصنيفات المنتج (Categories)
          </label>
          <Controller
            name="categories"
            control={control}
            defaultValue={[]}
            render={({ field }) => {
              const selectedIds = Array.isArray(field.value) ? field.value : [];

              const toggleCat = (id) => {
                const num = Number(id);
                const next = selectedIds.includes(num)
                  ? selectedIds.filter((x) => x !== num)
                  : [...selectedIds, num];
                field.onChange(next);
              };

              return (
                <div>
                  {/* Selected Category Tags */}
                  <div className="category-tags-wrap">
                    {selectedIds.length === 0 ? (
                      <span className="empty-category-text">
                        لم يتم اختيار أي تصنيف بعد. اختر تصنيفًا من القائمة أدناه:
                      </span>
                    ) : (
                      selectedIds.map((id) => {
                        const cat = categories.find((c) => Number(c.id) === Number(id));
                        return (
                          <span key={id} className="selected-category-pill">
                            {cat ? cat.name : `تصنيف #${id}`}
                            <button
                              type="button"
                              onClick={() => toggleCat(id)}
                              className="remove-cat-btn"
                              title="إزالة التصنيف"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>

                  {/* Categories Search & Picker */}
                  <div className="category-picker-box">
                    <input
                      type="text"
                      className="category-search-input"
                      placeholder="ابحث في تصنيفات المتجر..."
                      value={catSearch}
                      onChange={(e) => setCatSearch(e.target.value)}
                    />
                    <div className="category-checkboxes-grid">
                      {filteredCategories.slice(0, 15).map((cat) => {
                        const isChecked = selectedIds.includes(Number(cat.id));
                        return (
                          <label
                            key={cat.id}
                            className={`category-item-checkbox ${isChecked ? "category-item-checkbox--checked" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCat(cat.id)}
                            />
                            <span>{cat.name}</span>
                          </label>
                        );
                      })}
                      {filteredCategories.length === 0 && (
                        <div className="no-cat-found">لا توجد تصنيفات مطابقة.</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </div>

        {/* Brand */}
        <div className="form-group" id="field-brand_id">
          <label className="form-label">العلامة التجارية (Brand)</label>
          <select className="form-select" {...register("brand_id")}>
            <option value="">-- بدون علامة تجارية --</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
