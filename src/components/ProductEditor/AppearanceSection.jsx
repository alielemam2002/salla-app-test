import { Image as ImageIcon } from "lucide-react";
import { FormRow, TextInput } from "../ui/index.js";
import EditorSection from "./EditorSection.jsx";
import EditorField from "./EditorField.jsx";
import ImageGallery from "./ImageGallery.jsx";
import MediaManager from "./MediaManager.jsx";

export default function AppearanceSection({
  register,
  sectionScore,
  images = [],
  onAddImage,
  onRemoveImage,
  onSetMainImage,
  onSaveSection,
  isSaving,
  isImageActionBusy,
  productId,
  token,
  altText,
  media,
}) {
  return (
    <EditorSection
      id="section-appearance"
      icon={ImageIcon}
      title="المظهر والصور"
      description="الصورة الرئيسية، صور المعرض، إدارة الوسائط، العنوان الترويجي، والعنوان الفرعي."
      score={sectionScore}
      fallbackWeight={15}
      saveLabel="حفظ المظهر"
      onSave={onSaveSection}
      isSaving={isSaving}
    >
      <div id="field-images" className="editor-field">
        <div className="form-group">
          <label className="form-label" htmlFor="editor-new-image-url">
            معرض صور المنتج (الأساسية والإضافية)
            <span className="form-required">*</span>
          </label>
          <ImageGallery
            inputId="editor-new-image-url"
            images={images}
            onAdd={onAddImage}
            onRemove={onRemoveImage}
            onSetMain={onSetMainImage}
            isBusy={isImageActionBusy}
          />
        </div>
      </div>

      <MediaManager
        productId={productId}
        token={token}
        images={images}
        altText={altText}
        onMediaChanged={media?.refresh}
        onAddVideo={media?.addVideo}
        isAddingVideo={media?.isAddingVideo}
      />

      <FormRow>
        <EditorField
          anchor="promotion_title"
          label="عنوان ترويجي (Promotion Title)"
          hint="يظهر كشارة بارزة فوق بطاقة المنتج في المتجر."
        >
          <TextInput
            type="text"
            placeholder="مثال: خصم 30% بمناسبة اليوم الوطني"
            {...register("promotion_title")}
          />
        </EditorField>

        <EditorField
          anchor="subtitle"
          label="عنوان فرعي (Subtitle)"
          hint="نص توضيحي قصير أسفل اسم المنتج."
        >
          <TextInput
            type="text"
            placeholder="مثال: قطن مصري 100% عالي الجودة"
            {...register("subtitle")}
          />
        </EditorField>
      </FormRow>
    </EditorSection>
  );
}
