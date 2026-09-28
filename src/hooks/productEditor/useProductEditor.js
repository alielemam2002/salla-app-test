import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  useProduct,
  useTaxonomies,
  useProductOptions,
  useProductVariants,
  useProductImages,
  useUpdateProduct,
  useDeleteProductImage,
  useCreateOption,
  useDeleteOption,
  useUpdateVariant,
} from "../useProductQueries.js";
import {
  EMPTY_PRODUCT_FORM,
  buildProductPayload,
  normalizeProductImages,
  productToFormValues,
} from "../../utils/productEditorForm.js";
import { useEditorImages } from "./useEditorImages.js";
import { useCompletionScore } from "./useCompletionScore.js";

const EMPTY_TAXONOMIES = { categories: [], brands: [] };
const EMPTY_LIST = [];

/**
 * All data and behaviour behind the Product Editor: queries, the form,
 * gallery, live completion score, save flow and option/variant mutations.
 * The editor components only render what this returns.
 */
export function useProductEditor({
  productId,
  token,
  initialProduct,
  showToast,
}) {
  const notify = useCallback(
    (message, type) => showToast?.(message, type),
    [showToast],
  );

  // Queries
  const {
    data: product,
    isLoading: isProductLoading,
    refetch: refetchProduct,
    isRefetching,
  } = useProduct(productId, token, initialProduct);
  const { data: taxonomies = EMPTY_TAXONOMIES } = useTaxonomies(token);
  const { data: options = EMPTY_LIST, isLoading: isOptionsLoading } =
    useProductOptions(productId, token);
  const { data: variants = EMPTY_LIST, isLoading: isVariantsLoading } =
    useProductVariants(productId, token);
  const { data: queryImages = EMPTY_LIST } = useProductImages(productId, token);

  // Mutations
  const updateProduct = useUpdateProduct(productId, token);
  const deleteImage = useDeleteProductImage(productId, token);
  const createOption = useCreateOption(productId, token);
  const deleteOption = useDeleteOption(productId, token);
  const updateVariant = useUpdateVariant(productId, token);

  const form = useForm({ defaultValues: EMPTY_PRODUCT_FORM });
  const { reset, watch, handleSubmit, getValues } = form;

  const getAltText = useCallback(() => getValues("name"), [getValues]);
  const gallery = useEditorImages({
    deleteImage: deleteImage.mutateAsync,
    notify,
    getAltText,
  });
  const { setImages } = gallery;

  // Populate form + gallery whenever the product (or its images) arrive
  useEffect(() => {
    if (!product) return;
    reset(productToFormValues(product));
    const nextImages = normalizeProductImages(product, queryImages);
    if (nextImages) setImages(nextImages);
  }, [product, queryImages, reset, setImages]);

  const values = watch();
  const scoreData = useCompletionScore({
    values,
    images: gallery.images,
    options,
    variants,
    product,
  });

  const save = handleSubmit(async (formData) => {
    const { payload, error } = buildProductPayload(formData, gallery.images);
    if (error) {
      notify(error, "error");
      return;
    }
    try {
      await updateProduct.mutateAsync(payload);
      notify("تم حفظ بيانات المنتج بنجاح في سلة!", "success");
    } catch (err) {
      notify(err.message || "حدث خطأ أثناء حفظ المنتج في سلة", "error");
    }
  });

  const runMutation = useCallback(
    async (mutation, arg, success, fallbackError) => {
      try {
        await mutation.mutateAsync(arg);
        notify(success, "success");
      } catch (err) {
        notify(err.message || fallbackError, "error");
      }
    },
    [notify],
  );

  const handleCreateOption = (data) =>
    runMutation(
      createOption,
      data,
      "تمت إضافة الخيار بنجاح!",
      "تعذر إضافة الخيار",
    );
  const handleDeleteOption = (optionId) =>
    runMutation(
      deleteOption,
      optionId,
      "تم حذف الخيار بنجاح!",
      "تعذر حذف الخيار",
    );
  const handleUpdateVariant = (data) =>
    runMutation(
      updateVariant,
      data,
      "تم تحديث بيانات المتغير بنجاح في سلة!",
      "تعذر تحديث المتغير",
    );

  return {
    product,
    isProductLoading,
    isRefetching,
    refetch: refetchProduct,
    taxonomies,
    options,
    variants,
    isOptionsLoading,
    isVariantsLoading,
    form,
    values,
    scoreData,
    gallery,
    save,
    isSaving: updateProduct.isPending,
    currency:
      (typeof product?.price === "object" && product.price?.currency) || "SAR",
    handleCreateOption,
    handleDeleteOption,
    handleUpdateVariant,
  };
}
