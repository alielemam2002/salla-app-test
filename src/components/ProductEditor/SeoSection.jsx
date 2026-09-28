import { useState } from "react";
import { Controller } from "react-hook-form";
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Save,
  Globe,
  Loader2,
  ExternalLink,
} from "lucide-react";
import Button from "../forms/Button.jsx";

export default function SeoSection({
  control,
  register,
  watch,
  sectionScore,
  onSaveSection,
  isSaving,
}) {
  const [tagInput, setTagInput] = useState("");

  const watchedName = watch("name") || "";
  const watchedSeoTitle = watch("metadata_title") || "";
  const watchedSeoDesc = watch("metadata_description") || "";
  const watchedSeoUrl = watch("metadata_url") || "";

  const displayTitle = watchedSeoTitle || watchedName || "عنوان المنتج في جوجل";
  const displayUrl = watchedSeoUrl
    ? `https://store.salla.sa/products/${watchedSeoUrl}`
    : "https://store.salla.sa/products/product-slug";
  const displayDesc =
    watchedSeoDesc ||
    "أدخل وصف SEO للمنتج ليظهر في نتائج بحث جوجل ويجذب المزيد من العملاء للشراء...";

  return (
    <div className="editor-section-card" id="section-seo">
      <div className="editor-section-header">
        <div className="section-header-title">
          <div className="section-header-icon">
            <Search size={18} />
          </div>
          <div>
            <h4 className="section-title">محركات البحث والتهيئة (SEO)</h4>
            <span className="section-desc">
              تحسين ظهور المنتج في محركات بحث Google والوسوم الترويجية.
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
            {sectionScore?.currentScore || 0}/{sectionScore?.targetWeight || 11}%
          </span>

          <Button
            size="small"
            variant="secondary"
            onClick={onSaveSection}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
            حفظ SEO
          </Button>
        </div>
      </div>

      <div className="editor-section-body">
        {/* Live Google Search Preview Card */}
        <div className="serp-preview-box">
          <div className="serp-preview-header">
            <Globe size={13} />
            <span>معاينة نتيجة بحث Google المباشرة (SERP Live Preview)</span>
          </div>
          <div className="serp-preview-content">
            <div className="serp-preview-url">
              {displayUrl}
              <ExternalLink size={10} style={{ display: "inline", marginInlineStart: 4 }} />
            </div>
            <div className="serp-preview-title">{displayTitle}</div>
            <div className="serp-preview-desc">{displayDesc}</div>
          </div>
        </div>

        {/* SEO Title */}
        <div className="form-group" id="field-metadata_title">
          <div className="form-label-row">
            <label className="form-label">عنوان SEO (metadata_title)</label>
            <span
              className={`char-counter ${watchedSeoTitle.length > 60 ? "char-counter--warn" : ""}`}
            >
              {watchedSeoTitle.length} / 60 حرف مُوصى به
            </span>
          </div>
          <input
            type="text"
            className="form-input"
            placeholder="مثال: قميص قطني فاخر للرجال بأفضل سعر | متجر الأناقة"
            {...register("metadata_title")}
          />
          <span className="form-hint">
            العنوان الذي يظهر باللون الأزرق في نتائج محرك بحث جوجل.
          </span>
        </div>

        {/* SEO Description */}
        <div className="form-group" id="field-metadata_description">
          <div className="form-label-row">
            <label className="form-label">وصف SEO (metadata_description)</label>
            <span
              className={`char-counter ${watchedSeoDesc.length > 160 ? "char-counter--warn" : ""}`}
            >
              {watchedSeoDesc.length} / 160 حرف مُوصى به
            </span>
          </div>
          <textarea
            rows={3}
            className="form-textarea"
            placeholder="اكتب وصفًا جذابًا ومقنعًا ومختصرًا يشرح مميزات المنتج ويحث الزائر على النقر..."
            {...register("metadata_description")}
          />
          <span className="form-hint">
            الوصف المختصر أسفل العنوان في صفحة نتائج البحث.
          </span>
        </div>

        {/* SEO URL Slug */}
        <div className="form-group" id="field-metadata_url">
          <label className="form-label">رابط المنتج المخصص (metadata_url / Slug)</label>
          <div className="slug-input-wrapper">
            <span className="slug-prefix">store.salla.sa/products/</span>
            <input
              type="text"
              className="form-input slug-input"
              placeholder="premium-cotton-tshirt"
              {...register("metadata_url")}
            />
          </div>
          <span className="form-hint">
            استخدم كلمات واضحة بالإنجليزية ومفصولة بشرطات (-) لتعزيز أرشفة الرابط.
          </span>
        </div>

        {/* Product Tags */}
        <div className="form-group" id="field-tags">
          <label className="form-label">وسوم المنتج (Tags)</label>
          <Controller
            name="tags"
            control={control}
            defaultValue={[]}
            render={({ field }) => {
              const currentTags = Array.isArray(field.value)
                ? field.value
                : typeof field.value === "string"
                  ? field.value.split(/[,;\n]+/).filter(Boolean)
                  : [];

              const addTag = () => {
                const trimmed = tagInput.trim().replace(/^#/, "");
                if (!trimmed) return;
                if (!currentTags.includes(trimmed)) {
                  field.onChange([...currentTags, trimmed]);
                }
                setTagInput("");
              };

              const removeTag = (t) => {
                field.onChange(currentTags.filter((x) => x !== t));
              };

              return (
                <div>
                  <div className="tags-chips-wrap">
                    {currentTags.length === 0 ? (
                      <span className="empty-category-text">
                        لا توجد وسوم مضافة. أضف وسومًا أدناه:
                      </span>
                    ) : (
                      currentTags.map((t) => (
                        <span key={t} className="tag-chip">
                          #{t}
                          <button
                            type="button"
                            onClick={() => removeTag(t)}
                            className="remove-tag-btn"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="add-tag-bar">
                    <input
                      type="text"
                      className="form-input add-tag-input"
                      placeholder="أدخل وسمًا جديدًا ثم اضغط إضافة أو Enter (مثال: ملابس_صيفية)..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                    />
                    <Button type="button" size="small" onClick={addTag}>
                      إضافة وسم
                    </Button>
                  </div>
                </div>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
