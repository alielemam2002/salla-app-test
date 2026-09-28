import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_PRODUCT_FORM,
  addImage,
  buildProductPayload,
  mapServerFieldErrors,
  productToFormValues,
  removeImage,
  setMainImage,
  toggleCategoryId,
  validateProductForm,
} from "../../utils/productForm.js";

/**
 * State and handlers for the Add/Edit product modal. Resets whenever the
 * modal opens or the product changes. `onSave(payload, productId)` must
 * resolve to `{ success, error?, fields? }`.
 */
export function useProductForm({ isOpen, product, onSave, onClose }) {
  const isEditing = Boolean(product);
  const [values, setValues] = useState(EMPTY_PRODUCT_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setGeneralError(null);
    setFieldErrors({});
    setImageUrlInput("");
    setValues(productToFormValues(product));
  }, [isOpen, product]);

  const setField = useCallback((field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const addImageFromInput = useCallback(() => {
    if (!imageUrlInput.trim()) return;
    setValues((prev) => ({
      ...prev,
      images: addImage(prev.images, imageUrlInput, prev.name || ""),
    }));
    setImageUrlInput("");
  }, [imageUrlInput]);

  const removeImageAt = useCallback((index) => {
    setValues((prev) => ({ ...prev, images: removeImage(prev.images, index) }));
  }, []);

  const setMainImageAt = useCallback((index) => {
    setValues((prev) => ({
      ...prev,
      images: setMainImage(prev.images, index),
    }));
  }, []);

  const toggleCategory = useCallback((catId) => {
    setValues((prev) => {
      const categories = toggleCategoryId(prev.categories, catId);
      return {
        ...prev,
        categories,
        manualCategoryIds: categories.join(", "),
      };
    });
  }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setGeneralError(null);

    const errors = validateProductForm(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    const payload = buildProductPayload(values, isEditing);

    try {
      const result = await onSave(payload, product?.id);
      setIsSubmitting(false);
      if (!result?.success) {
        setGeneralError(
          result?.error || "Salla rejected the product submission.",
        );
        if (result?.fields) setFieldErrors(mapServerFieldErrors(result.fields));
      } else {
        onClose();
      }
    } catch (err) {
      setIsSubmitting(false);
      setGeneralError(err.message || "An unexpected error occurred.");
    }
  };

  return {
    isEditing,
    values,
    fieldErrors,
    generalError,
    isSubmitting,
    setField,
    handleSubmit,
    images: {
      urlInput: imageUrlInput,
      setUrlInput: setImageUrlInput,
      add: addImageFromInput,
      remove: removeImageAt,
      setMain: setMainImageAt,
    },
    toggleCategory,
  };
}
