import { useState, useCallback } from "react";
import EditorHeader from "./EditorHeader.jsx";
import ProductCompletionCard from "./ProductCompletionCard.jsx";
import BasicInfoSection from "./BasicInfoSection.jsx";
import AppearanceSection from "./AppearanceSection.jsx";
import SeoSection from "./SeoSection.jsx";
import PricingInventorySection from "./PricingInventorySection.jsx";
import OptionsVariantsSection from "./OptionsVariantsSection.jsx";
import SaveBar from "./SaveBar.jsx";
import AiCopilotModal from "./AiCopilotModal.jsx";
import { useProductEditor } from "../../hooks/productEditor/useProductEditor.js";
import { useFieldNavigator } from "../../hooks/productEditor/useFieldNavigator.js";

/**
 * Full-page product editor (Arabic, RTL). All data and behaviour live in
 * `useProductEditor`; this component only lays out the sections.
 */
export default function ProductEditor({
  productId,
  token,
  initialProduct = null,
  onBack,
  showToast,
}) {
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const editor = useProductEditor({
    productId,
    token,
    initialProduct,
    showToast,
  });
  const navigateToField = useFieldNavigator();

  const {
    product,
    form,
    values,
    scoreData,
    gallery,
    save,
    isSaving,
  } = editor;
  const { register, control, watch, formState, setValue, getValues } = form;
  const { errors } = formState;
  const sections = scoreData?.sections;
  const sectionProps = { onSaveSection: save, isSaving };

  const handleApplyAiContent = useCallback(
    (aiData) => {
      if (!aiData) return;

      if (aiData.marketing_description) {
        setValue("description", aiData.marketing_description, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      if (aiData.promotion_title) {
        setValue("promotion_title", aiData.promotion_title, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      if (aiData.subtitle || aiData.short_description) {
        setValue("subtitle", aiData.subtitle || aiData.short_description, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      if (aiData.meta_title) {
        setValue("metadata_title", aiData.meta_title, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      if (aiData.meta_description) {
        setValue("metadata_description", aiData.meta_description, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      if (aiData.seo_slug) {
        setValue("metadata_url", aiData.seo_slug, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      if (Array.isArray(aiData.tags) && aiData.tags.length > 0) {
        const currentTags = getValues("tags") || [];
        const merged = Array.from(new Set([...currentTags, ...aiData.tags]));
        setValue("tags", merged, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      showToast?.(
        "تم تطبيق تحسينات الذكاء الاصطناعي بنجاح! راجع التغييرات ثم اضغط حفظ التغييرات.",
        "success",
      );
    },
    [setValue, getValues, showToast],
  );

  return (
    <div className="product-editor-container" dir="rtl" lang="ar">
      <EditorHeader
        productId={productId}
        name={values.name}
        sku={values.sku}
        storeUrl={product?.url}
        isLoading={editor.isProductLoading}
        isRefetching={editor.isRefetching}
        isSaving={isSaving}
        onBack={onBack}
        onRefresh={() => editor.refetch()}
        onSave={save}
        onOpenAi={() => setIsAiModalOpen(true)}
      />

      <ProductCompletionCard
        scoreData={scoreData}
        onNavigateToField={navigateToField}
      />

      <form onSubmit={save} className="editor-sections-stack">
        <BasicInfoSection
          control={control}
          register={register}
          errors={errors}
          sectionScore={sections?.basicInfo}
          categories={editor.taxonomies.categories}
          brands={editor.taxonomies.brands}
          onOpenAi={() => setIsAiModalOpen(true)}
          {...sectionProps}
        />

        <AppearanceSection
          register={register}
          sectionScore={sections?.appearance}
          images={gallery.images}
          onAddImage={gallery.addImage}
          onRemoveImage={gallery.removeImage}
          onSetMainImage={gallery.setMainImage}
          isImageActionBusy={gallery.isBusy}
          productId={productId}
          token={token}
          altText={values.name}
          media={editor.media}
          onOpenAi={() => setIsAiModalOpen(true)}
          {...sectionProps}
        />

        <SeoSection
          control={control}
          register={register}
          watch={watch}
          sectionScore={sections?.seo}
          productUrl={product?.urls?.customer || product?.url}
          onOpenAi={() => setIsAiModalOpen(true)}
          {...sectionProps}
        />

        <PricingInventorySection
          register={register}
          watch={watch}
          errors={errors}
          sectionScore={sections?.pricingInventory}
          currency={editor.currency}
          managedByBranches={Boolean(product?.managed_by_branches)}
          notifyQuantity={product?.notify_quantity}
          {...sectionProps}
        />

        <OptionsVariantsSection
          options={editor.options}
          variants={editor.variants}
          sectionScore={sections?.variants}
          onCreateOption={editor.handleCreateOption}
          onDeleteOption={editor.handleDeleteOption}
          onUpdateVariant={editor.handleUpdateVariant}
          isOptionsLoading={editor.isOptionsLoading}
          isVariantsLoading={editor.isVariantsLoading}
        />

        <SaveBar
          score={scoreData?.score}
          isSaving={isSaving}
          onCancel={onBack}
        />
      </form>

      <AiCopilotModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        product={{
          name: values.name,
          description: values.description,
          categoryName: editor.taxonomies?.categories?.find((c) =>
            values.categories?.includes?.(c.id),
          )?.name,
          price: values.price,
          currency: editor.currency,
          brandName: editor.taxonomies?.brands?.find((b) =>
            b.id === values.brand_id,
          )?.name,
        }}
        onApply={handleApplyAiContent}
        showToast={showToast}
      />
    </div>
  );
}
