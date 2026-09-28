import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProductDetails,
  fetchTaxonomies,
  updateProduct,
  fetchProductImages,
  uploadProductImage,
  deleteProductImage,
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
        throw new Error(res.error || "Failed to load product details");
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
export function useUpdateProduct(productId, token) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const res = await updateProduct(token, productId, payload);
      if (!res.success) {
        const error = new Error(res.error || "Failed to update product");
        error.fields = res.fields;
        error.code = res.code;
        throw error;
      }
      return res.product;
    },
    onSuccess: (updatedProduct) => {
      // Optimistically update product cache
      queryClient.setQueryData(productKeys.detail(productId), (old) => {
        if (!old) return updatedProduct;
        return { ...old, ...updatedProduct };
      });
      // Invalidate list query
      queryClient.invalidateQueries({ queryKey: productKeys.all });
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
        throw new Error(res.error || "Failed to upload image");
      }
      return res.image;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.images(productId) });
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
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
        throw new Error(res.error || "Failed to delete image");
      }
      return imageId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.images(productId) });
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
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
        throw new Error(res.error || "Failed to update variant");
      }
      return res.variant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.variants(productId) });
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
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
        throw new Error(res.error || "Failed to create option");
      }
      return res.option;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.options(productId) });
      queryClient.invalidateQueries({ queryKey: productKeys.variants(productId) });
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
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
        throw new Error(res.error || "Failed to delete option");
      }
      return optionId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.options(productId) });
      queryClient.invalidateQueries({ queryKey: productKeys.variants(productId) });
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) });
    },
  });
}
