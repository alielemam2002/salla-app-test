import { useState, useEffect, useMemo } from "react";
import Button from "../forms/Button.jsx";
import {
  calculateDiscountedPrice,
  prepareBulkDiscountPayload,
  prepareRemoveDiscountPayload,
  bulkUpdateProductPrices,
  getProductRegularPrice,
} from "../../utils/discountsApi.js";
import { fetchAllProducts } from "../../utils/productsApi.js";
import {
  Tag,
  Percent,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  X,
  Layers,
  Calendar,
  RotateCcw,
  Sparkles,
  Info,
} from "lucide-react";

export default function BulkDiscountModal({
  isOpen,
  onClose,
  selectedProducts = [],
  allLoadedProducts = [],
  totalStoreProducts = 0,
  categories = [],
  token,
  onSuccess,
  showToast,
}) {
  // Modal Mode: "apply" | "remove"
  const [mode, setMode] = useState("apply");

  // Target: "selected" | "category" | "all"
  const [target, setTarget] = useState(
    selectedProducts.length > 0 ? "selected" : "all",
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  // Discount Configuration
  const [discountType, setDiscountType] = useState("percentage"); // "percentage" | "fixed"
  const [discountValue, setDiscountValue] = useState("20");
  const [saleEndDate, setSaleEndDate] = useState("");

  // Process states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState("");
  const [progressInfo, setProgressInfo] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [generalError, setGeneralError] = useState(null);
  const [resultSummary, setResultSummary] = useState(null);

  // Reset state when opening
  useEffect(() => {
    if (!isOpen) return;

    setGeneralError(null);
    setResultSummary(null);
    setIsConfirming(false);
    setIsProcessing(false);
    setProgressInfo(null);
    setProcessStep("");

    if (selectedProducts.length > 0) {
      setTarget("selected");
    } else {
      setTarget("all");
    }

    if (categories?.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [isOpen]);

  // Determine which products to show in preview sample
  const previewProducts = useMemo(() => {
    if (target === "selected") {
      return selectedProducts;
    }
    if (target === "category") {
      if (!selectedCategoryId) return [];
      const catIdNum = Number(selectedCategoryId);
      const matched = allLoadedProducts.filter((p) => {
        if (!Array.isArray(p.categories)) return false;
        return p.categories.some(
          (c) => (typeof c === "object" ? c.id : c) === catIdNum,
        );
      });
      return matched.length > 0 ? matched : allLoadedProducts.slice(0, 5);
    }
    // "all"
    return allLoadedProducts.slice(0, 8);
  }, [target, selectedProducts, allLoadedProducts, selectedCategoryId]);

  // Total count estimate
  const estimatedTargetCount = useMemo(() => {
    if (target === "selected") return selectedProducts.length;
    if (target === "category") {
      const cat = categories.find((c) => c.id === Number(selectedCategoryId));
      return cat?.products_count || previewProducts.length || "All in category";
    }
    return totalStoreProducts || allLoadedProducts.length || "All store items";
  }, [
    target,
    selectedProducts.length,
    categories,
    selectedCategoryId,
    previewProducts.length,
    totalStoreProducts,
    allLoadedProducts.length,
  ]);

  if (!isOpen) return null;

  // Validation
  const valNum = Number(discountValue);
  let validationError = null;

  if (mode === "apply") {
    if (discountValue === "" || isNaN(valNum) || valNum <= 0) {
      validationError = "Please enter a valid discount value greater than 0.";
    } else if (discountType === "percentage" && valNum > 100) {
      validationError = "Discount percentage cannot exceed 100%.";
    }
  }

  if (target === "selected" && selectedProducts.length === 0) {
    validationError =
      "No products are selected. Please select products from the table or choose another target.";
  }
  if (target === "category" && !selectedCategoryId) {
    validationError = "Please select a category.";
  }

  // Handle Submit Execution
  const handleExecute = async () => {
    if (validationError) return;
    setGeneralError(null);
    setIsProcessing(true);
    setProgressInfo(null);

    try {
      let targetProducts = [];

      // Step 1: Resolve products
      if (target === "selected") {
        targetProducts = selectedProducts;
      } else {
        setProcessStep("Fetching target products from Salla...");
        const filterOpts = {};
        if (target === "category") {
          filterOpts.category = selectedCategoryId;
        }

        const res = await fetchAllProducts(token, {
          perPage: 60,
          ...filterOpts,
          onProgress: (p) => {
            setProgressInfo(
              `Page ${p.page} of ${p.totalPages} (${p.loaded} items)`,
            );
          },
        });

        if (!res.success) {
          throw new Error(
            res.error || "Failed to fetch products for bulk update",
          );
        }
        targetProducts = res.products || [];
      }

      if (targetProducts.length === 0) {
        throw new Error("No products found for the selected target.");
      }

      // Step 2: Build Salla payload
      setProcessStep(
        `Updating ${targetProducts.length} product prices on Salla...`,
      );

      let payload = [];
      if (mode === "apply") {
        payload = prepareBulkDiscountPayload(targetProducts, {
          discountType,
          discountValue: valNum,
          saleEnd: saleEndDate || undefined,
        });
      } else {
        payload = prepareRemoveDiscountPayload(targetProducts);
      }

      if (payload.length === 0) {
        throw new Error(
          "None of the target products have a valid regular price to update.",
        );
      }

      // Step 3: Send to Salla bulkPrice
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

      // Trigger cache/state refresh in parent
      onSuccess?.({
        payload,
        mode,
        count: payload.length,
      });
    } catch (err) {
      setIsProcessing(false);
      setGeneralError(
        err.message || "An unexpected error occurred during bulk update.",
      );
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content modal-content--lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-discount-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div
              className={`modal-icon-badge ${mode === "remove" ? "modal-icon-badge--danger" : ""}`}
            >
              {mode === "apply" ? <Tag size={20} /> : <RotateCcw size={20} />}
            </div>
            <div>
              <h3 id="bulk-discount-title" className="modal-title">
                {mode === "apply"
                  ? "Bulk Product Discount"
                  : "Remove Product Discounts"}
              </h3>
              <span className="modal-subtitle">
                Official Salla Bulk Price API (POST
                /admin/v2/products/prices/bulkPrice)
              </span>
            </div>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Mode Toggle (Apply vs Remove) */}
        <div className="bulk-mode-toggle">
          <button
            type="button"
            className={`bulk-mode-btn ${mode === "apply" ? "active" : ""}`}
            onClick={() => {
              setMode("apply");
              setIsConfirming(false);
              setResultSummary(null);
            }}
            disabled={isProcessing}
          >
            <Percent size={15} /> Apply Discount
          </button>
          <button
            type="button"
            className={`bulk-mode-btn ${mode === "remove" ? "active active--remove" : ""}`}
            onClick={() => {
              setMode("remove");
              setIsConfirming(false);
              setResultSummary(null);
            }}
            disabled={isProcessing}
          >
            <RotateCcw size={15} /> Remove Discount
          </button>
        </div>

        {/* Modal Content */}
        <div className="modal-body">
          {/* General Error Banner */}
          {generalError && (
            <div className="form-alert form-alert--error">
              <AlertCircle size={18} />
              <div className="form-alert-content">
                <strong>Error: </strong>
                <span>{generalError}</span>
              </div>
            </div>
          )}

          {/* Success State */}
          {resultSummary ? (
            <div className="bulk-success-state">
              <CheckCircle2 size={48} className="bulk-success-icon" />
              <h4>Operation Completed!</h4>
              <p>{resultSummary.message}</p>
              <div className="bulk-success-meta">
                <span>
                  Updated items: <strong>{resultSummary.count}</strong>
                </span>
              </div>
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          ) : isConfirming ? (
            /* Confirmation Step */
            <div className="bulk-confirm-step">
              <div className="form-alert form-alert--warning">
                <Info size={20} />
                <div className="form-alert-content">
                  <strong>Please confirm bulk update</strong>
                  <p>
                    You are about to{" "}
                    {mode === "apply"
                      ? "apply a discount to"
                      : "remove discounts from"}{" "}
                    <strong>{estimatedTargetCount}</strong> products on Salla.
                  </p>
                </div>
              </div>

              <div className="confirm-summary-box">
                <div className="confirm-summary-row">
                  <span>Action:</span>
                  <strong>
                    {mode === "apply" ? "Apply Discount" : "Remove Sale Price"}
                  </strong>
                </div>
                {mode === "apply" && (
                  <div className="confirm-summary-row">
                    <span>Discount:</span>
                    <strong>
                      {discountType === "percentage"
                        ? `${discountValue}%`
                        : `${discountValue} SAR`}
                    </strong>
                  </div>
                )}
                <div className="confirm-summary-row">
                  <span>Target:</span>
                  <strong>
                    {target === "selected"
                      ? `${selectedProducts.length} Selected Products`
                      : target === "category"
                        ? `Category #${selectedCategoryId}`
                        : "All Store Products"}
                  </strong>
                </div>
                {mode === "apply" && saleEndDate && (
                  <div className="confirm-summary-row">
                    <span>Sale End Date:</span>
                    <strong>{saleEndDate}</strong>
                  </div>
                )}
              </div>

              {isProcessing ? (
                <div className="bulk-progress-box">
                  <div className="bulk-spinner" />
                  <div>
                    <strong>{processStep}</strong>
                    {progressInfo && <span>{progressInfo}</span>}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            /* Configuration Step */
            <>
              {/* TARGET SELECTION */}
              <div className="form-section">
                <label className="form-label">1. Choose Target Products</label>
                <div className="target-cards-grid">
                  <label
                    className={`target-card ${target === "selected" ? "active" : ""} ${selectedProducts.length === 0 ? "disabled" : ""}`}
                  >
                    <input
                      type="radio"
                      name="discount-target"
                      value="selected"
                      checked={target === "selected"}
                      disabled={selectedProducts.length === 0 || isProcessing}
                      onChange={() => setTarget("selected")}
                    />
                    <div className="target-card-content">
                      <div className="target-card-title">Selected Products</div>
                      <div className="target-card-desc">
                        {selectedProducts.length > 0
                          ? `${selectedProducts.length} items checked in table`
                          : "No products currently selected"}
                      </div>
                    </div>
                  </label>

                  <label
                    className={`target-card ${target === "category" ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="discount-target"
                      value="category"
                      checked={target === "category"}
                      disabled={isProcessing}
                      onChange={() => setTarget("category")}
                    />
                    <div className="target-card-content">
                      <div className="target-card-title">Category</div>
                      <div className="target-card-desc">
                        Apply to all products in a specific category
                      </div>
                    </div>
                  </label>

                  <label
                    className={`target-card ${target === "all" ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="discount-target"
                      value="all"
                      checked={target === "all"}
                      disabled={isProcessing}
                      onChange={() => setTarget("all")}
                    />
                    <div className="target-card-content">
                      <div className="target-card-title">All Products</div>
                      <div className="target-card-desc">
                        Apply storewide across all catalog items
                      </div>
                    </div>
                  </label>
                </div>

                {target === "category" && (
                  <div className="category-select-wrap">
                    <label className="form-label" htmlFor="discount-category">
                      Select Category
                    </label>
                    {categories.length > 0 ? (
                      <select
                        id="discount-category"
                        className="form-select"
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                        disabled={isProcessing}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} (#{c.id})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Enter Category ID"
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                        disabled={isProcessing}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="form-divider" />

              {/* DISCOUNT CONFIGURATION (ONLY IN APPLY MODE) */}
              {mode === "apply" ? (
                <div className="form-section">
                  <label className="form-label">2. Configure Discount</label>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Discount Type</label>
                      <div className="discount-type-group">
                        <button
                          type="button"
                          className={`discount-type-btn ${discountType === "percentage" ? "active" : ""}`}
                          onClick={() => setDiscountType("percentage")}
                          disabled={isProcessing}
                        >
                          <Percent size={15} /> Percentage (%)
                        </button>
                        <button
                          type="button"
                          className={`discount-type-btn ${discountType === "fixed" ? "active" : ""}`}
                          onClick={() => setDiscountType("fixed")}
                          disabled={isProcessing}
                        >
                          <DollarSign size={15} /> Fixed Amount (SAR)
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="discount-val">
                        {discountType === "percentage"
                          ? "Discount Percentage"
                          : "Discount Amount (SAR)"}
                      </label>
                      <div className="input-with-suffix">
                        <input
                          id="discount-val"
                          type="number"
                          step="any"
                          min="0.1"
                          max={
                            discountType === "percentage" ? "100" : undefined
                          }
                          className="form-input"
                          placeholder={
                            discountType === "percentage" ? "20" : "15"
                          }
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          disabled={isProcessing}
                        />
                        <span className="input-suffix">
                          {discountType === "percentage" ? "%" : "SAR"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="sale-end-date">
                      Sale End Date (Optional)
                    </label>
                    <div className="input-with-icon">
                      <Calendar size={16} className="input-icon" />
                      <input
                        id="sale-end-date"
                        type="date"
                        className="form-input input-with-icon-field"
                        value={saleEndDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setSaleEndDate(e.target.value)}
                        disabled={isProcessing}
                      />
                      {saleEndDate && (
                        <button
                          type="button"
                          className="input-clear-btn"
                          onClick={() => setSaleEndDate("")}
                          title="Clear date"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <span className="form-hint">
                      Leave empty if the promotion has no fixed expiration date.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="form-alert form-alert--info">
                  <RotateCcw size={18} />
                  <div className="form-alert-content">
                    <strong>Resetting Sale Prices: </strong>
                    <span>
                      This will remove the promotional sale price and restore
                      the original regular price for all matching products on
                      Salla.
                    </span>
                  </div>
                </div>
              )}

              <div className="form-divider" />

              {/* PREVIEW SECTION */}
              <div className="form-section">
                <div className="preview-header">
                  <div className="section-title">
                    <Sparkles size={16} /> Sample Preview (
                    {previewProducts.length} items)
                  </div>
                  <span className="preview-target-badge">
                    Target: {estimatedTargetCount} products
                  </span>
                </div>

                <div className="preview-table-wrap">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Regular Price</th>
                        {mode === "apply" && <th>Discount</th>}
                        <th>
                          {mode === "apply"
                            ? "New Sale Price"
                            : "Restored Price"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewProducts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="preview-empty">
                            No sample products available for this target.
                          </td>
                        </tr>
                      ) : (
                        previewProducts.map((p) => {
                          const regPrice = getProductRegularPrice(p);

                          const hasCurrentSale = Boolean(
                            p.sale_price?.amount || p.sale_price,
                          );

                          const currentSale =
                            p.sale_price?.amount ?? p.sale_price ?? null;

                          const newSalePrice =
                            mode === "apply"
                              ? calculateDiscountedPrice(
                                  regPrice,
                                  discountType,
                                  valNum,
                                )
                              : regPrice;

                          return (
                            <tr key={p.id}>
                              <td>
                                <div className="preview-product-name">
                                  {p.name}
                                </div>
                                <div className="preview-product-meta">
                                  #{p.id}
                                  {hasCurrentSale && mode === "apply" && (
                                    <span className="preview-replace-tag">
                                      Replaces current sale ({currentSale} SAR)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>{regPrice} SAR</td>
                              {mode === "apply" && (
                                <td className="preview-discount-col">
                                  {discountType === "percentage"
                                    ? `-${valNum}%`
                                    : `-${valNum} SAR`}
                                </td>
                              )}
                              <td>
                                <strong className="preview-new-price">
                                  {newSalePrice} SAR
                                </strong>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {resultSummary ? (
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          ) : isConfirming ? (
            <>
              <Button
                onClick={() => setIsConfirming(false)}
                disabled={isProcessing}
              >
                Back
              </Button>
              <Button
                variant={mode === "remove" ? "danger" : "primary"}
                onClick={handleExecute}
                disabled={isProcessing}
              >
                {isProcessing
                  ? "Processing..."
                  : mode === "apply"
                    ? "Confirm & Apply Discount"
                    : "Confirm & Remove Discount"}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onClose} disabled={isProcessing}>
                Cancel
              </Button>
              <Button
                variant={mode === "remove" ? "danger" : "primary"}
                onClick={() => setIsConfirming(true)}
                disabled={Boolean(validationError) || isProcessing}
              >
                {mode === "apply"
                  ? "Review & Apply Discount"
                  : "Review & Remove Discount"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
