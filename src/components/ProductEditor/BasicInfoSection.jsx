import { Controller } from "react-hook-form";
import { Info } from "lucide-react";
import { Select, Textarea, TextInput } from "../ui/index.js";
import EditorSection from "./EditorSection.jsx";
import EditorField from "./EditorField.jsx";
import CategoryPicker from "./CategoryPicker.jsx";

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
  return (
    <EditorSection
      id="section-basicInfo"
      icon={Info}
      title="المعلومات الأساسية"
      description="اسم المنتج، الوصف، التصنيفات، والعلامة التجارية."
      score={sectionScore}
      fallbackWeight={20}
      saveLabel="حفظ القسم"
      onSave={onSaveSection}
      isSaving={isSaving}
    >
      <EditorField
        anchor="name"
        label="اسم المنتج"
        required
        error={errors?.name?.message}
      >
        <TextInput
          type="text"
          invalid={Boolean(errors?.name)}
          placeholder="مثال: قميص قطني كلاسيكي"
          {...register("name", { required: "اسم المنتج مطلوب" })}
        />
      </EditorField>

      <EditorField
        anchor="description"
        label="وصف المنتج"
        required
        hint="الوصف الغني بالمعلومات يرفع معدل المبيعات ويحسن ظهور المنتج في محركات البحث."
      >
        <Textarea
          rows={5}
          placeholder="أدخل وصفًا تفصيليًا وجذابًا للمنتج ومميزاته ومواصفاته..."
          {...register("description")}
        />
      </EditorField>

      <div id="field-categories" className="editor-field">
        <div className="form-group">
          <span className="form-label">تصنيفات المنتج (Categories)</span>
          <Controller
            name="categories"
            control={control}
            defaultValue={[]}
            render={({ field }) => (
              <CategoryPicker
                categories={categories}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </div>

      <EditorField anchor="brand_id" label="العلامة التجارية (Brand)">
        <Select
          placeholder="-- بدون علامة تجارية --"
          options={brands.map((b) => ({ value: b.id, label: b.name }))}
          {...register("brand_id")}
        />
      </EditorField>
    </EditorSection>
  );
}
