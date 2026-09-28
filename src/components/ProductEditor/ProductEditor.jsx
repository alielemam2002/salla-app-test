import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import {
  ArrowRight,
  Save,
  RotateCw,
  Loader2,
  ExternalLink,
  Tag,
} from "lucide-react";
import Button from "../forms/Button.jsx";
import ProductCompletionCard from "./ProductCompletionCard.jsx";
import BasicInfoSection from "./BasicInfoSection.jsx";
import AppearanceSection from "./AppearanceSection.jsx";
import SeoSection from "./SeoSection.jsx";
import PricingInventorySection from "./PricingInventorySection.jsx";
import OptionsVariantsSection from "./OptionsVariantsSection.jsx";
import {
  useProduct,
  useTaxonomies,
  useProductOptions,
  useProductVariants,
  useProductImages,
  useUpdateProduct,
  useUploadProductImage,
  useDeleteProductImage,
  useCreateOption,
  useDeleteOption,
  useUpdateVariant,
} from "../../hooks/useProductQueries.js";
import { calculateCompletionScore } from "../../utils/productCompletion.js";
import { slugify } from "../../utils/slugify.js";

export default function ProductEditor({
  productId,
  token,
  initialProduct = null,
  onBack,
  showToast,
}) {
  // TanStack Queries
  const {
    data: product,
    isLoading: isProductLoading,
    refetch: refetchProduct,
    isRefetching,
  } = useProduct(productId, token, initialProduct);

  const { data: taxonomies = { categories: [], brands: [] } } =
    useTaxonomies(token);
  const { data: queryOptions = [], isLoading: isOptionsLoading } =
    useProductOptions(productId, token);
  const { data: queryVariants = [], isLoading: isVariantsLoading } =
    useProductVariants(productId, token);
  const { data: queryImages = [] } = useProductImages(productId, token);

  // TanStack Mutations
  const updateProductMutation = useUpdateProduct(productId, token);
  const uploadImageMutation = useUploadProductImage(productId, token);
  const deleteImageMutation = useDeleteProductImage(productId, token);
  const createOptionMutation = useCreateOption(productId, token);
  const deleteOptionMutation = useDeleteOption(productId, token);
  const updateVariantMutation = useUpdateVariant(productId, token);

  // Local state for images (to support reordering and primary selection)
  const [localImages, setLocalImages] = useState([]);
  const [isImageActionBusy, setIsImageActionBusy] = useState(false);

  // React Hook Form initialization
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      description: "",
      categories: [],
      brand_id: "",
      price: "",
      sale_price: "",
      sale_end: "",
      cost_price: "",
      quantity: "",
      unlimited_quantity: false,
      maximum_quantity_per_order: "",
      hide_quantity: false,
      sku: "",
      gtin: "",
      mpn: "",
      promotion_title: "",
      subtitle: "",
      tags: [],
      metadata_title: "",
      metadata_description: "",
      metadata_url: "",
    },
  });

  // Populate form when product data arrives
  useEffect(() => {
    if (!product) return;

    // Price extraction
    const p =
      typeof product.regular_price === "object"
        ? product.regular_price?.amount
        : product.regular_price ??
          (typeof product.price === "object"
            ? product.price?.amount
            : product.price ?? "");

    // Salla returns sale_price { amount: 0 } when there is no sale
    const rawSale =
      typeof product.sale_price === "object"
        ? product.sale_price?.amount
        : product.sale_price;
    const sp = Number(rawSale) > 0 ? rawSale : "";

    const cp =
      typeof product.cost_price === "object"
        ? product.cost_price?.amount
        : product.cost_price ?? "";

    let catIds = [];
    if (Array.isArray(product.categories)) {
      catIds = product.categories
        .map((c) => (typeof c === "object" ? c.id : c))
        .filter(Boolean);
    }

    let tagList = [];
    if (Array.isArray(product.tags)) {
      // Keep { id, name } so saving can send tag IDs, as Salla's PUT expects
      tagList = product.tags
        .map((t) =>
          typeof t === "object" ? { id: t.id, name: t.name } : { name: String(t) },
        )
        .filter((t) => t.name);
    } else if (typeof product.tags === "string") {
      tagList = product.tags
        .split(/[,;\n]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((name) => ({ name }));
    }

    reset({
      name: product.name || "",
      description: product.description || "",
      categories: catIds,
      brand_id: product.brand_id || product.brand?.id || "",
      price: p,
      sale_price: sp,
      sale_end: sp !== "" ? product.sale_end || "" : "",
      cost_price: cp,
      quantity: product.unlimited_quantity ? "" : (product.quantity ?? ""),
      unlimited_quantity: Boolean(product.unlimited_quantity),
      maximum_quantity_per_order: product.maximum_quantity_per_order || "",
      hide_quantity: Boolean(product.hide_quantity),
      sku: product.sku || "",
      gtin: product.gtin || product.barcode || "",
      mpn: product.mpn || "",
      promotion_title: product.promotion_title || "",
      subtitle: product.subtitle || "",
      tags: tagList,
      metadata_title: product.metadata_title || product.metadata?.title || "",
      metadata_description:
        product.metadata_description || product.metadata?.description || "",
      metadata_url: product.metadata_url || product.metadata?.url || "",
    });

    // Populate images
    const rawImages =
      Array.isArray(queryImages) && queryImages.length > 0
        ? queryImages
        : Array.isArray(product.images) && product.images.length > 0
          ? product.images
          : [];

    if (rawImages.length > 0) {
      setLocalImages(
        rawImages.map((img, idx) => ({
          id: typeof img === "object" ? img.id : undefined,
          original: typeof img === "string" ? img : img.url || img.original || "",
          default: Boolean(img.default || img.is_main || img.main || idx === 0),
          sort: img.sort !== undefined ? Number(img.sort) : idx + 1,
          alt: typeof img === "object" ? img.alt || "" : "",
        })),
      );
    } else if (product.thumbnail || product.main_image) {
      setLocalImages([
        {
          original: product.thumbnail || product.main_image,
          default: true,
          sort: 1,
          alt: product.name || "",
        },
      ]);
    }
  }, [product, queryImages, reset]);

  // Watch all fields in real time for dynamic completion score
  const watchedValues = watch();

  // Combine form values + current images + options/variants for real-time score calculation
  const mergedCurrentProduct = useMemo(() => {
    return {
      ...watchedValues,
      images: localImages,
      options: queryOptions.length > 0 ? queryOptions : product?.options || [],
      variants:
        queryVariants.length > 0
          ? queryVariants
          : product?.skus || product?.variants || [],
      thumbnail: localImages[0]?.original || product?.thumbnail,
    };
  }, [watchedValues, localImages, queryOptions, queryVariants, product]);

  // Real-time dynamic completion score
  const scoreData = useMemo(() => {
    return calculateCompletionScore(mergedCurrentProduct);
  }, [mergedCurrentProduct]);

  // Scroll to and highlight a specific field when clicked from the completion card
  const handleNavigateToField = useCallback((fieldId) => {
    const el = document.getElementById(fieldId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("field-highlight-pulse");
      setTimeout(() => el.classList.remove("field-highlight-pulse"), 2500);

      // Focus input if available
      const input = el.querySelector("input, textarea, select");
      if (input) input.focus();
    }
  }, []);

  // Image actions
  const handleAddImage = (url) => {
    setLocalImages((prev) => {
      const isFirst = prev.length === 0;
      return [
        ...prev,
        {
          original: url,
          default: isFirst,
          sort: prev.length + 1,
          alt: watchedValues.name || "",
        },
      ];
    });
    showToast?.("تمت إضافة الصورة. اضغط حفظ لتطبيقها على سلة.", "info");
  };

  const handleRemoveImage = async (index, imageId) => {
    if (imageId) {
      setIsImageActionBusy(true);
      try {
        await deleteImageMutation.mutateAsync(imageId);
        showToast?.("تم حذف الصورة بنجاح من سلة", "success");
      } catch (err) {
        showToast?.(err.message || "تعذر حذف الصورة", "error");
      } finally {
        setIsImageActionBusy(false);
      }
    }

    setLocalImages((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      if (next.length > 0 && !next.some((img) => img.default)) {
        next[0].default = true;
      }
      return next;
    });
  };

  const handleSetMainImage = (index) => {
    setLocalImages((prev) => {
      const target = prev[index];
      if (!target) return prev;
      const reordered = [
        { ...target, default: true, sort: 1 },
        ...prev
          .filter((_, idx) => idx !== index)
          .map((img, i) => ({ ...img, default: false, sort: i + 2 })),
      ];
      return reordered;
    });
    showToast?.("تم تعيين الصورة كرئيسية. اضغط حفظ لتثبيت الترتيب.", "info");
  };

  // Section / Master Save Handler
  const executeSave = async (formData) => {
    const payload = {
      name: formData.name.trim(),
      price: Number(formData.price),
      description: formData.description.trim() || undefined,
      subtitle: formData.subtitle.trim() || undefined,
      promotion_title: formData.promotion_title.trim() || undefined,
      sku: formData.sku.trim() || undefined,
      gtin: formData.gtin.trim() || undefined,
      mpn: formData.mpn.trim() || undefined,
      metadata_title: formData.metadata_title.trim() || undefined,
      metadata_description: formData.metadata_description.trim() || undefined,
      metadata_url: slugify(formData.metadata_url) || undefined,
      unlimited_quantity: formData.unlimited_quantity,
      hide_quantity: formData.hide_quantity,
      maximum_quantity_per_order:
        formData.maximum_quantity_per_order !== "" &&
        Number(formData.maximum_quantity_per_order) >= 0
          ? Number(formData.maximum_quantity_per_order)
          : 0,
    };

    // Salla ignores quantity when unlimited_quantity=true, so don't send it
    if (
      !formData.unlimited_quantity &&
      formData.quantity !== "" &&
      formData.quantity !== undefined &&
      !isNaN(Number(formData.quantity))
    ) {
      payload.quantity = Number(formData.quantity);
    }

    if (formData.sale_price !== "" && Number(formData.sale_price) > 0) {
      payload.sale_price = Number(formData.sale_price);
      payload.sale_end = formData.sale_end || null;
    } else {
      payload.sale_price = null;
      payload.sale_end = null;
    }

    if (formData.cost_price !== "" && !isNaN(Number(formData.cost_price))) {
      payload.cost_price = Number(formData.cost_price);
    }

    if (Array.isArray(formData.categories) && formData.categories.length > 0) {
      payload.categories = formData.categories;
    }

    if (formData.brand_id && !isNaN(Number(formData.brand_id))) {
      payload.brand_id = Number(formData.brand_id);
    }

    if (Array.isArray(formData.tags) && formData.tags.length > 0) {
      payload.tags = formData.tags;
    }

    if (localImages.length > 0) {
      payload.images = localImages.map((img, idx) => ({
        ...(img.id ? { id: img.id } : {}),
        original: img.original,
        default: idx === 0,
        sort: idx + 1,
        alt: img.alt || formData.name || "",
      }));
    }

    try {
      await updateProductMutation.mutateAsync(payload);
      showToast?.("تم حفظ بيانات المنتج بنجاح في سلة!", "success");
    } catch (err) {
      showToast?.(err.message || "حدث خطأ أثناء حفظ المنتج في سلة", "error");
    }
  };

  const handleSaveAll = handleSubmit((data) => executeSave(data));

  return (
    <div className="product-editor-container" dir="rtl" lang="ar">
      {/* Editor Top Navigation Bar */}
      <div className="editor-top-nav">
        <div className="editor-nav-start">
          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={onBack}
            className="editor-back-btn"
          >
            <ArrowRight size={16} />
            العودة لقائمة المنتجات
          </Button>

          <div className="editor-product-meta-header">
            <h2 className="editor-product-name">
              {isProductLoading ? "جارِ التحميل..." : watchedValues.name || "تعديل المنتج"}
            </h2>
            <div className="editor-product-subtags">
              <span className="editor-id-tag">ID: #{productId}</span>
              {watchedValues.sku && (
                <span className="editor-sku-tag">
                  <Tag size={12} /> {watchedValues.sku}
                </span>
              )}
              {product?.url && (
                <a
                  href={product.url}
                  target="_blank"
                  rel="noreferrer"
                  className="editor-store-link"
                >
                  عرض في المتجر <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="editor-nav-actions">
          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={() => refetchProduct()}
            disabled={isRefetching}
            title="تحديث البيانات من سلة"
          >
            <RotateCw size={14} className={isRefetching ? "spin" : ""} />
            تحديث
          </Button>

          <Button
            type="button"
            size="small"
            onClick={handleSaveAll}
            disabled={updateProductMutation.isPending}
          >
            {updateProductMutation.isPending ? (
              <Loader2 size={14} className="spin" />
            ) : (
              <Save size={14} />
            )}
            حفظ التغييرات
          </Button>
        </div>
      </div>

      {/* Product Completion Score Card */}
      <ProductCompletionCard
        scoreData={scoreData}
        onNavigateToField={handleNavigateToField}
      />

      {/* Editor Form & Sections */}
      <form onSubmit={handleSaveAll} className="editor-sections-stack">
        {/* Section 1: Basic Information */}
        <BasicInfoSection
          control={control}
          register={register}
          errors={errors}
          sectionScore={scoreData?.sections?.basicInfo}
          categories={taxonomies.categories}
          brands={taxonomies.brands}
          onSaveSection={handleSaveAll}
          isSaving={updateProductMutation.isPending}
        />

        {/* Section 2: Appearance & Images */}
        <AppearanceSection
          register={register}
          sectionScore={scoreData?.sections?.appearance}
          images={localImages}
          onAddImage={handleAddImage}
          onRemoveImage={handleRemoveImage}
          onSetMainImage={handleSetMainImage}
          onSaveSection={handleSaveAll}
          isSaving={updateProductMutation.isPending}
          isImageActionBusy={isImageActionBusy}
        />

        {/* Section 3: SEO */}
        <SeoSection
          control={control}
          register={register}
          watch={watch}
          sectionScore={scoreData?.sections?.seo}
          productUrl={product?.urls?.customer || product?.url}
          onSaveSection={handleSaveAll}
          isSaving={updateProductMutation.isPending}
        />

        {/* Section 4: Pricing & Inventory */}
        <PricingInventorySection
          register={register}
          watch={watch}
          errors={errors}
          sectionScore={scoreData?.sections?.pricingInventory}
          currency={
            (typeof product?.price === "object" && product.price?.currency) ||
            "SAR"
          }
          managedByBranches={Boolean(product?.managed_by_branches)}
          notifyQuantity={product?.notify_quantity}
          onSaveSection={handleSaveAll}
          isSaving={updateProductMutation.isPending}
        />

        {/* Section 5: Options & Variants */}
        <OptionsVariantsSection
          options={queryOptions}
          variants={queryVariants}
          sectionScore={scoreData?.sections?.variants}
          onCreateOption={async (optData) => {
            try {
              await createOptionMutation.mutateAsync(optData);
              showToast?.("تمت إضافة الخيار بنجاح!", "success");
            } catch (err) {
              showToast?.(err.message || "تعذر إضافة الخيار", "error");
            }
          }}
          onDeleteOption={async (optId) => {
            try {
              await deleteOptionMutation.mutateAsync(optId);
              showToast?.("تم حذف الخيار بنجاح!", "success");
            } catch (err) {
              showToast?.(err.message || "تعذر حذف الخيار", "error");
            }
          }}
          onUpdateVariant={async ({ variantId, variantData }) => {
            try {
              await updateVariantMutation.mutateAsync({ variantId, variantData });
              showToast?.("تم تحديث بيانات المتغير بنجاح في سلة!", "success");
            } catch (err) {
              showToast?.(err.message || "تعذر تحديث المتغير", "error");
            }
          }}
          isOptionsLoading={isOptionsLoading}
          isVariantsLoading={isVariantsLoading}
        />

        {/* Floating Bottom Sticky Save Bar */}
        <div className="editor-sticky-save-bar">
          <div className="sticky-score-indicator">
            <span className="sticky-score-num">{scoreData?.score}%</span>
            <span>نسبة اكتمال بيانات المنتج</span>
          </div>

          <div className="sticky-save-actions">
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={onBack}
            >
              إلغاء والعودة
            </Button>
            <Button
              type="submit"
              disabled={updateProductMutation.isPending}
            >
              {updateProductMutation.isPending ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <Save size={14} />
              )}
              حفظ جميع البيانات
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
