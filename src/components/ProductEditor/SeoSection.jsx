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
import { slugify } from "../../utils/slugify.js";

const tagName = (t) => (typeof t === "object" ? t?.name : t) || "";

/**
 * Build the storefront URL preview. Salla product URLs look like
 * https://{store}/{slug}/p{id}, so swap the slug segment when we know it.
 */
function buildPreviewUrl(productUrl, slug) {
  if (productUrl && slug) {
    const replaced = productUrl.replace(/\/[^/]+\/(p\d+)\/?$/, `/${slug}/$1`);
    if (replaced !== productUrl) return replaced;
  }
  return productUrl || `https://store.salla.sa/${slug || "product-slug"}`;
}

export default function SeoSection({
  control,
  register,
  watch,
  sectionScore,
  onSaveSection,
  isSaving,
  productUrl,
}) {
  const [tagInput, setTagInput] = useState("");

  const watchedName = watch("name") || "";
  const watchedSeoTitle = watch("metadata_title") || "";
  const watchedSeoDesc = watch("metadata_description") || "";
  const watchedSeoUrl = watch("metadata_url") || "";

  const displayTitle = watchedSeoTitle || watchedName || "عنوان المنتج في جوجل";
  const displayUrl = buildPreviewUrl(productUrl, slugify(watchedSeoUrl));
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
          <Controller
            name="metadata_url"
            control={control}
            render={({ field }) => (
              <div className="slug-input-wrapper" dir="ltr">
                <span className="slug-prefix">/</span>
                <input
                  type="text"
                  className="form-input slug-input"
                  placeholder="premium-cotton-tshirt"
                  value={field.value || ""}
                  onChange={field.onChange}
                  onBlur={() => {
                    field.onChange(slugify(field.value));
                    field.onBlur();
                  }}
                />
              </div>
            )}
          />
          <span className="form-hint">
            كلمات قصيرة مفصولة بشرطات (-). تُحوَّل المسافات والرموز تلقائيًا عند
            الخروج من الحقل.
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
              // Tags are { id, name }; new ones have no id yet and are
              // created on save (Salla's PUT only accepts tag IDs)
              const currentTags = Array.isArray(field.value)
                ? field.value.map((t) => (typeof t === "object" ? t : { name: t }))
                : [];

              const addTag = () => {
                const trimmed = tagInput.trim().replace(/^#/, "");
                if (!trimmed) return;
                if (!currentTags.some((t) => tagName(t) === trimmed)) {
                  field.onChange([...currentTags, { name: trimmed }]);
                }
                setTagInput("");
              };

              const removeTag = (name) => {
                field.onChange(currentTags.filter((t) => tagName(t) !== name));
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
                        <span key={tagName(t)} className="tag-chip">
                          #{tagName(t)}
                          <button
                            type="button"
                            aria-label={`حذف الوسم ${tagName(t)}`}
                            onClick={() => removeTag(tagName(t))}
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
