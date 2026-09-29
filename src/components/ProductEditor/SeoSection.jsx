import { Controller } from "react-hook-form";
import { Search, Sparkles } from "lucide-react";
import { Textarea, TextInput } from "../ui/index.js";
import EditorSection from "./EditorSection.jsx";
import EditorField from "./EditorField.jsx";
import SerpPreview from "./SerpPreview.jsx";
import TagInput from "./TagInput.jsx";
import { slugify } from "../../utils/slugify.js";
import { buildPreviewUrl } from "../../utils/productEditorForm.js";

const TITLE_LIMIT = 60;
const DESC_LIMIT = 160;

function CharCounter({ length, limit }) {
  return (
    <span
      className={`char-counter ${length > limit ? "char-counter--warn" : ""}`}
    >
      {length} / {limit} حرف مُوصى به
    </span>
  );
}

export default function SeoSection({
  control,
  register,
  watch,
  sectionScore,
  onSaveSection,
  isSaving,
  productUrl,
  onOpenAi,
}) {
  const name = watch("name") || "";
  const seoTitle = watch("metadata_title") || "";
  const seoDesc = watch("metadata_description") || "";
  const seoUrl = watch("metadata_url") || "";

  return (
    <EditorSection
      id="section-seo"
      icon={Search}
      title="محركات البحث والتهيئة (SEO)"
      description="تحسين ظهور المنتج في محركات بحث Google والوسوم الترويجية."
      score={sectionScore}
      fallbackWeight={11}
      saveLabel="حفظ SEO"
      onSave={onSaveSection}
      isSaving={isSaving}
    >
      {onOpenAi && (
        <div className="seo-ai-banner">
          <div className="seo-ai-banner-text">
            <strong>تحسين محركات البحث بالذكاء الاصطناعي</strong>
            <span>توليد عنوان، وصف SEO مقنع، رابط مخصص (Slug) ووسوم ذكية بضغطة زر.</span>
          </div>
          <button
            type="button"
            className="ai-inline-trigger-btn"
            onClick={onOpenAi}
          >
            <Sparkles size={13} aria-hidden="true" />
            <span>توليد بيانات الـ SEO ✨</span>
          </button>
        </div>
      )}

      <SerpPreview
        url={buildPreviewUrl(productUrl, slugify(seoUrl))}
        title={seoTitle || name || "عنوان المنتج في جوجل"}
        description={
          seoDesc ||
          "أدخل وصف SEO للمنتج ليظهر في نتائج بحث جوجل ويجذب المزيد من العملاء للشراء..."
        }
      />

      <EditorField
        anchor="metadata_title"
        label="عنوان SEO (metadata_title)"
        labelExtra={
          <CharCounter length={seoTitle.length} limit={TITLE_LIMIT} />
        }
        hint="العنوان الذي يظهر باللون الأزرق في نتائج محرك بحث جوجل."
      >
        <TextInput
          type="text"
          placeholder="مثال: قميص قطني فاخر للرجال بأفضل سعر | متجر الأناقة"
          {...register("metadata_title")}
        />
      </EditorField>

      <EditorField
        anchor="metadata_description"
        label="وصف SEO (metadata_description)"
        labelExtra={<CharCounter length={seoDesc.length} limit={DESC_LIMIT} />}
        hint="الوصف المختصر أسفل العنوان في صفحة نتائج البحث."
      >
        <Textarea
          rows={3}
          placeholder="اكتب وصفًا جذابًا ومقنعًا ومختصرًا يشرح مميزات المنتج ويحث الزائر على النقر..."
          {...register("metadata_description")}
        />
      </EditorField>

      <Controller
        name="metadata_url"
        control={control}
        render={({ field }) => (
          <EditorField
            anchor="metadata_url"
            label="رابط المنتج المخصص (metadata_url / Slug)"
            hint="كلمات قصيرة مفصولة بشرطات (-). تُحوَّل المسافات والرموز تلقائيًا عند الخروج من الحقل."
          >
            <TextInput
              type="text"
              dir="ltr"
              prefix="/"
              placeholder="premium-cotton-tshirt"
              value={field.value || ""}
              onChange={field.onChange}
              onBlur={() => {
                field.onChange(slugify(field.value));
                field.onBlur();
              }}
            />
          </EditorField>
        )}
      />

      <div id="field-tags" className="editor-field">
        <div className="form-group">
          <label className="form-label" htmlFor="editor-tag-input">
            وسوم المنتج (Tags)
          </label>
          <Controller
            name="tags"
            control={control}
            defaultValue={[]}
            render={({ field }) => (
              <TagInput
                inputId="editor-tag-input"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </div>
    </EditorSection>
  );
}
