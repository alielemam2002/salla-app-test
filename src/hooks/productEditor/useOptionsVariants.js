import { useCallback, useState } from "react";
import {
  parseOptionValues,
  variantToFormValues,
} from "../../utils/productEditorForm.js";

const EMPTY_OPTION = { name: "", type: "text", valuesInput: "" };

/**
 * Form state for the "add option" and "edit variant" dialogs.
 * `onCreateOption` / `onUpdateVariant` do the API call and report errors.
 */
export function useOptionsVariants({ onCreateOption, onUpdateVariant }) {
  // Add option dialog
  const [isAddOptionOpen, setIsAddOptionOpen] = useState(false);
  const [optionForm, setOptionForm] = useState(EMPTY_OPTION);
  const [isCreatingOption, setIsCreatingOption] = useState(false);

  // Edit variant dialog
  const [editingVariant, setEditingVariant] = useState(null);
  const [variantForm, setVariantForm] = useState({});
  const [isUpdatingVariant, setIsUpdatingVariant] = useState(false);

  const openAddOption = useCallback(() => setIsAddOptionOpen(true), []);
  const closeAddOption = useCallback(() => setIsAddOptionOpen(false), []);

  const changeOptionField = useCallback(
    (field, value) => setOptionForm((prev) => ({ ...prev, [field]: value })),
    [],
  );

  const submitOption = useCallback(async () => {
    const name = optionForm.name.trim();
    if (!name) return;
    setIsCreatingOption(true);
    try {
      await onCreateOption?.({
        name,
        type: optionForm.type,
        values: parseOptionValues(optionForm.valuesInput),
      });
      setIsAddOptionOpen(false);
      setOptionForm((prev) => ({ ...prev, name: "", valuesInput: "" }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingOption(false);
    }
  }, [optionForm, onCreateOption]);

  const openEditVariant = useCallback((variant) => {
    setEditingVariant(variant);
    setVariantForm(variantToFormValues(variant));
  }, []);

  const closeEditVariant = useCallback(() => setEditingVariant(null), []);

  const changeVariantField = useCallback(
    (field, value) => setVariantForm((prev) => ({ ...prev, [field]: value })),
    [],
  );

  const submitVariant = useCallback(async () => {
    if (!editingVariant) return;
    setIsUpdatingVariant(true);
    try {
      await onUpdateVariant?.({
        variantId: editingVariant.id,
        variantData: variantForm,
      });
      setEditingVariant(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingVariant(false);
    }
  }, [editingVariant, variantForm, onUpdateVariant]);

  return {
    addOption: {
      isOpen: isAddOptionOpen,
      form: optionForm,
      isSubmitting: isCreatingOption,
      open: openAddOption,
      close: closeAddOption,
      change: changeOptionField,
      submit: submitOption,
    },
    editVariant: {
      variant: editingVariant,
      form: variantForm,
      isSubmitting: isUpdatingVariant,
      open: openEditVariant,
      close: closeEditVariant,
      change: changeVariantField,
      submit: submitVariant,
    },
  };
}
