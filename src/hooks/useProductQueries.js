import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProductDetails,
  fetchTaxonomies,
  updateProduct,
  fetchProductImages,
  uploadProductImage,
  deleteProductImage,
  attachProductVideo,
  fetchProductOptions,
  createProductOption,
  deleteProductOption,
  fetchProductVariants,
  updateProductVariant,
} from "../utils/productsApi.js";

// Query keys
export const productKeys = {
  all: ["products"],
  detail: (id) => ["products", "detail", String(id)],
  taxonomies: () => ["taxonomies"],
  options: (id) => ["products", "options", String(id)],
  variants: (id) => ["products", "variants", String(id)],
  images: (id) => ["products", "images", String(id)],
};

/**
 * Fetch detailed product data.
 */
export function useProduct(productId, token, initialData = null) {
  return useQuery({
    queryKey: productKeys.detail(productId),
    queryFn: async () => {
      const res = await getProductDetails(token, productId);
      if (!res.success) {
        throw new Error(res.error || "تعذّر تحميل تفاصيل المنتج");
      }
      return res.product;
    },
    enabled: Boolean(productId && token),
    initialData: initialData || undefined,
  });
}

/**
 * Fetch store categories and brands.
 */
export function useTaxonomies(token) {
  return useQuery({
    queryKey: productKeys.taxonomies(),
    queryFn: async () => {
      const res = await fetchTaxonomies(token);
      if (!res.success) {
        return { categories: [], brands: [] };
      }
      return {
        categories: res.categories || [],
        brands: res.brands || [],
      };
    },
    enabled: Boolean(token),
    staleTime: 1000 * 60 * 10, // Categories change infrequently
  });
}

/**
 * Fetch product options.
 */
export function useProductOptions(productId, token) {
  return useQuery({
    queryKey: productKeys.options(productId),
    queryFn: async () => {
      const res = await fetchProductOptions(token, productId);
      return res.options || [];
    },
    enabled: Boolean(productId && token),
  });
}

/**
 * Fetch product variants / SKUs.
 */
export function useProductVariants(productId, token) {
  return useQuery({
    queryKey: productKeys.variants(productId),
    queryFn: async () => {
      const res = await fetchProductVariants(token, productId);
      return res.variants || [];
    },
    enabled: Boolean(productId && token),
  });
}

/**
 * Fetch product images.
 */
export function useProductImages(productId, token) {
  return useQuery({
    queryKey: productKeys.images(productId),
    queryFn: async () => {
      const res = await fetchProductImages(token, productId);
      return res.images || [];
    },
    enabled: Boolean(productId && token),
  });
}

/**
 * Mutation: Update product details (basic info, pricing, SEO, categories, tags).
 */
function formatApiError(res, fallbackMessage = "تعذّر تنفيذ العملية") {
  let msg = res.error || fallbackMessage;
  if (res.fields && typeof res.fields === "object") {
    const details = Object.entries(res.fields)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .filter(Boolean)
      .join(" | ");
    if (details && !msg.includes(details)) {
      msg = `${msg} (${details})`;
    }
  }
  const error = new Error(msg);
  error.fields = res.fields;
  error.code = res.code;
  return error;
}

export function useUpdateProduct(productId, token) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const res = await updateProduct(token, productId, payload);
      if (!res.success) {
        throw formatApiError(res, "تعذّر حفظ المنتج");
      }
      return res.product;
    },
    onSuccess: (updatedProduct, variables) => {
      // Optimistically update product cache, preserving saved fields from payload
      queryClient.setQueryData(productKeys.detail(productId), (old) => {
        const base = old || {};
        const merged = {
          ...base,
          ...variables,
          ...(updatedProduct || {}),
        };

        const promo =
          updatedProduct?.promotion_title ||
          updatedProduct?.promotional_title ||
          updatedProduct?.promotion?.title ||
          variables?.promotion_title ||
          variables?.promotional_title ||
          base.promotion_title ||
          base.promotional_title ||
          "";
        merged.promotion_title = promo;
        merged.promotional_title = promo;

        const sub =
          updatedProduct?.subtitle ||
          updatedProduct?.sub_title ||
          updatedProduct?.short_description ||
          variables?.subtitle ||
          variables?.sub_title ||
          base.subtitle ||
          base.sub_title ||
          "";
        merged.subtitle = sub;
        merged.sub_title = sub;

        return merged;
      });
      // Invalidate list query only without clobbering current product detail query
      queryClient.invalidateQueries({ queryKey: productKeys.all, exact: true });
    },
  });
}

/**
 * Mutation: Upload / Attach an image to product.
 */
export function useUploadProductImage(productId, token) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (imageData) => {
      const res = await uploadProductImage(token, productId, imageData);
      if (!res.success) {
        throw formatApiError(res, "تعذّر رفع الصورة");
      }
      return res.image;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productKeys.images(productId),
      });
      queryClient.invalidateQueries({
        queryKey: productKeys.detail(productId),
      });
    },
  });
}

/**
 * Mutation: Delete an image from product.
 */
export function useDeleteProductImage(productId, token) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (imageId) => {
      const res = await deleteProductImage(token, productId, imageId);
      if (!res.success) {
        throw formatApiError(res, "تعذّر حذف الصورة");
      }
      return imageId;
    },
    // Only the images: refetching the product would reset unsaved form edits.
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productKeys.images(productId),
      });
    },
  });
}

/**
 * Mutation: Add a YouTube video to a product (the only video type Salla
 * accepts). Salla returns it with the product's images.
 */
export function useAttachProductVideo(productId, token) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videoUrl) => {
      const res = await attachProductVideo(token, productId, videoUrl);
      if (!res.success) {
        throw formatApiError(res, "تعذّرت إضافة الفيديو");
      }
      return res.video;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productKeys.images(productId),
      });
    },
  });
}

/**
 * Mutation: Update a product variant (SKU, price, stock, weight, barcode).
 */
export function useUpdateVariant(productId, token) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ variantId, variantData }) => {
      const res = await updateProductVariant(
        token,
        productId,
        variantId,
        variantData,
      );
      if (!res.success) {
        throw formatApiError(res, "تعذّر تعديل النسخة");
      }
      return res.variant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productKeys.variants(productId),
      });
      queryClient.invalidateQueries({
        queryKey: productKeys.detail(productId),
      });
    },
  });
}

/**
 * Mutation: Create a new option for a product.
 */
export function useCreateOption(productId, token) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (optionData) => {
      const res = await createProductOption(token, productId, optionData);
      if (!res.success) {
        throw formatApiError(res, "تعذّرت إضافة الخيار");
      }
      return res.option;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productKeys.options(productId),
      });
      queryClient.invalidateQueries({
        queryKey: productKeys.variants(productId),
      });
      queryClient.invalidateQueries({
        queryKey: productKeys.detail(productId),
      });
    },
  });
}

/**
 * Mutation: Delete an option from a product.
 */
export function useDeleteOption(productId, token) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (optionId) => {
      const res = await deleteProductOption(token, productId, optionId);
      if (!res.success) {
        throw formatApiError(res, "تعذّر حذف الخيار");
      }
      return optionId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productKeys.options(productId),
      });
      queryClient.invalidateQueries({
        queryKey: productKeys.variants(productId),
      });
      queryClient.invalidateQueries({
        queryKey: productKeys.detail(productId),
      });
    },
  });
}
