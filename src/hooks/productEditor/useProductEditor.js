import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  useProduct,
  useTaxonomies,
  useProductOptions,
  useProductVariants,
  useProductImages,
  useUpdateProduct,
  useDeleteProductImage,
  useAttachProductVideo,
  productKeys,
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
  const attachVideo = useAttachProductVideo(productId, token);
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

  // Populate the form when the product arrives. Kept apart from the images
  // effect so refetching images (after an upload or delete) never wipes
  // unsaved form edits.
  useEffect(() => {
    if (!product) return;
    const formVals = productToFormValues(product);
    const current = getValues();
    if (!formVals.subtitle && current?.subtitle) {
      formVals.subtitle = current.subtitle;
    }
    if (!formVals.promotion_title && current?.promotion_title) {
      formVals.promotion_title = current.promotion_title;
    }
    reset(formVals);
  }, [product, reset, getValues]);

  // Gallery = Salla's images, plus image links added here but not saved yet.
  useEffect(() => {
    if (!product) return;
    const nextImages = normalizeProductImages(product, queryImages);
    if (!nextImages) return;
    setImages((prev) => [...nextImages, ...prev.filter((img) => img.isLocal)]);
  }, [product, queryImages, setImages]);

  const queryClient = useQueryClient();
  const refreshMedia = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: productKeys.images(productId),
      }),
    [queryClient, productId],
  );

  const addVideo = useCallback(
    async (videoUrl) => {
      try {
        await attachVideo.mutateAsync(videoUrl);
        notify("تمت إضافة الفيديو إلى المنتج في سلة.", "success");
        return true;
      } catch (err) {
        notify(err.message || "تعذر إضافة الفيديو", "error");
        return false;
      }
    },
    [attachVideo, notify],
  );

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
      if (typeof window !== "undefined" && productId) {
        try {
          localStorage.setItem(
            `salla_product_meta_${productId}`,
            JSON.stringify({
              subtitle: formData.subtitle || "",
              promotion_title: formData.promotion_title || "",
            }),
          );
        } catch {
          // Ignore storage errors
        }
      }
      reset(formData);
      // Saved links are Salla's now: stop treating them as local and reload.
      setImages((prev) =>
        prev.map((img) => {
          if (!img.isLocal) return img;
          const { isLocal: _isLocal, ...saved } = img;
          return saved;
        }),
      );
      refreshMedia();
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
    media: {
      refresh: refreshMedia,
      addVideo,
      isAddingVideo: Boolean(attachVideo?.isPending),
    },
    save,
    isSaving: updateProduct.isPending,
    currency:
      (typeof product?.price === "object" && product.price?.currency) || "SAR",
    handleCreateOption,
    handleDeleteOption,
    handleUpdateVariant,
  };
}
