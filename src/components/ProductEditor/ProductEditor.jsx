import EditorHeader from "./EditorHeader.jsx";
import ProductCompletionCard from "./ProductCompletionCard.jsx";
import BasicInfoSection from "./BasicInfoSection.jsx";
import AppearanceSection from "./AppearanceSection.jsx";
import SeoSection from "./SeoSection.jsx";
import PricingInventorySection from "./PricingInventorySection.jsx";
import OptionsVariantsSection from "./OptionsVariantsSection.jsx";
import SaveBar from "./SaveBar.jsx";
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
  const editor = useProductEditor({
    productId,
    token,
    initialProduct,
    showToast,
  });
  const navigateToField = useFieldNavigator();

  const {
    product,
    form: { register, control, watch, formState },
    values,
    scoreData,
    gallery,
    save,
    isSaving,
  } = editor;
  const { errors } = formState;
  const sections = scoreData?.sections;
  const sectionProps = { onSaveSection: save, isSaving };

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
          {...sectionProps}
        />

        <SeoSection
          control={control}
          register={register}
          watch={watch}
          sectionScore={sections?.seo}
          productUrl={product?.urls?.customer || product?.url}
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
    </div>
  );
}
