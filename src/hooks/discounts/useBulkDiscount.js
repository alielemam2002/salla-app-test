import { useEffect, useMemo, useState } from "react";
import {
  bulkUpdateProductPrices,
  prepareBulkDiscountPayload,
  prepareRemoveDiscountPayload,
} from "../../utils/discountsApi.js";
import { fetchAllProducts } from "../../utils/productsApi.js";
import {
  buildPreviewRows,
  estimateTargetCount,
  getPreviewProducts,
  validateBulkDiscount,
} from "../../utils/bulkDiscount.js";

/**
 * State machine for the bulk discount modal:
 * configure → confirm → processing → result.
 */
export function useBulkDiscount({
  isOpen,
  selectedProducts = [],
  allLoadedProducts = [],
  totalStoreProducts = 0,
  categories = [],
  token,
  onSuccess,
  showToast,
}) {
  const [mode, setModeState] = useState("apply"); // "apply" | "remove"
  const [target, setTarget] = useState(
    selectedProducts.length > 0 ? "selected" : "all",
  ); // "selected" | "category" | "all"
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const [discountType, setDiscountType] = useState("percentage"); // | "fixed"
  const [discountValue, setDiscountValue] = useState("20");
  const [saleEndDate, setSaleEndDate] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState("");
  const [progressInfo, setProgressInfo] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [generalError, setGeneralError] = useState(null);
  const [resultSummary, setResultSummary] = useState(null);

  // Reset when the modal opens
  useEffect(() => {
    if (!isOpen) return;

    setGeneralError(null);
    setResultSummary(null);
    setIsConfirming(false);
    setIsProcessing(false);
    setProgressInfo(null);
    setProcessStep("");
    setTarget(selectedProducts.length > 0 ? "selected" : "all");

    if (categories?.length > 0) {
      setSelectedCategoryId((current) => current || categories[0].id);
    }
    // Only on open: selection/categories changes while open must not reset the flow
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const setMode = (next) => {
    setModeState(next);
    setIsConfirming(false);
    setResultSummary(null);
  };

  const previewProducts = useMemo(
    () =>
      getPreviewProducts({
        target,
        selectedProducts,
        allLoadedProducts,
        selectedCategoryId,
      }),
    [target, selectedProducts, allLoadedProducts, selectedCategoryId],
  );

  const estimatedTargetCount = estimateTargetCount({
    target,
    selectedProducts,
    categories,
    selectedCategoryId,
    previewCount: previewProducts.length,
    totalStoreProducts,
    allLoadedCount: allLoadedProducts.length,
  });

  const previewRows = useMemo(
    () =>
      buildPreviewRows(previewProducts, { mode, discountType, discountValue }),
    [previewProducts, mode, discountType, discountValue],
  );

  const validationError = validateBulkDiscount({
    mode,
    discountType,
    discountValue,
    target,
    selectedCount: selectedProducts.length,
    selectedCategoryId,
  });

  const resolveTargetProducts = async () => {
    if (target === "selected") return selectedProducts;

    setProcessStep("Fetching target products from Salla...");
    const res = await fetchAllProducts(token, {
      perPage: 60,
      ...(target === "category" ? { category: selectedCategoryId } : {}),
      onProgress: (p) => {
        setProgressInfo(
          `Page ${p.page} of ${p.totalPages} (${p.loaded} items)`,
        );
      },
    });
    if (!res.success) {
      throw new Error(res.error || "Failed to fetch products for bulk update");
    }
    return res.products || [];
  };

  const execute = async () => {
    if (validationError) return;
    setGeneralError(null);
    setIsProcessing(true);
    setProgressInfo(null);

    try {
      const targetProducts = await resolveTargetProducts();
      if (targetProducts.length === 0) {
        throw new Error("No products found for the selected target.");
      }

      setProcessStep(
        `Updating ${targetProducts.length} product prices on Salla...`,
      );

      const payload =
        mode === "apply"
          ? prepareBulkDiscountPayload(targetProducts, {
              discountType,
              discountValue: Number(discountValue),
              saleEnd: saleEndDate || undefined,
            })
          : prepareRemoveDiscountPayload(targetProducts);

      if (payload.length === 0) {
        throw new Error(
          "None of the target products have a valid regular price to update.",
        );
      }

      const result = await bulkUpdateProductPrices(token, payload);
      if (!result.success) {
        throw new Error(
          result.error || "Salla rejected the bulk price update.",
        );
      }

      setIsProcessing(false);
      setIsConfirming(false);
      setResultSummary({
        success: true,
        count: payload.length,
        message:
          result.message ||
          (mode === "apply"
            ? `Successfully applied discount to ${payload.length} products.`
            : `Successfully removed discounts from ${payload.length} products.`),
      });

      showToast?.(
        mode === "apply"
          ? `Bulk discount applied to ${payload.length} products!`
          : `Discounts removed from ${payload.length} products!`,
        "success",
      );

      onSuccess?.({ payload, mode, count: payload.length });
    } catch (err) {
      setIsProcessing(false);
      setGeneralError(
        err.message || "An unexpected error occurred during bulk update.",
      );
    }
  };

  return {
    mode,
    setMode,
    target,
    setTarget,
    selectedCategoryId,
    setSelectedCategoryId,
    discountType,
    setDiscountType,
    discountValue,
    setDiscountValue,
    saleEndDate,
    setSaleEndDate,
    isProcessing,
    processStep,
    progressInfo,
    isConfirming,
    setIsConfirming,
    generalError,
    resultSummary,
    previewRows,
    estimatedTargetCount,
    validationError,
    execute,
  };
}
