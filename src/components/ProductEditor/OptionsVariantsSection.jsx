import { useState } from "react";
import {
  Layers,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  X,
  Save,
  Check,
} from "lucide-react";
import Button from "../forms/Button.jsx";

export default function OptionsVariantsSection({
  options = [],
  variants = [],
  sectionScore,
  onCreateOption,
  onDeleteOption,
  onUpdateVariant,
  isOptionsLoading,
  isVariantsLoading,
}) {
  // Option creation modal state
  const [isAddOptionOpen, setIsAddOptionOpen] = useState(false);
  const [optionName, setOptionName] = useState("");
  const [optionType, setOptionType] = useState("text");
  const [optionValuesInput, setOptionValuesInput] = useState("");
  const [isCreatingOption, setIsCreatingOption] = useState(false);

  // Variant edit modal state
  const [editingVariant, setEditingVariant] = useState(null);
  const [variantFormData, setVariantFormData] = useState({});
  const [isUpdatingVariant, setIsUpdatingVariant] = useState(false);

  // Handle Option creation
  const handleCreateOptionSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = optionName.trim();
    if (!trimmedName) return;

    const values = optionValuesInput
      .split(/[,;\n]+/)
      .map((v) => v.trim())
      .filter(Boolean)
      .map((name) => ({ name }));

    setIsCreatingOption(true);
    try {
      await onCreateOption?.({
        name: trimmedName,
        type: optionType,
        values,
      });
      setIsAddOptionOpen(false);
      setOptionName("");
      setOptionValuesInput("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingOption(false);
    }
  };

  // Open variant edit modal
  const handleOpenEditVariant = (variant) => {
    setEditingVariant(variant);
    const p = typeof variant.price === "object" ? variant.price?.amount : variant.price;
    const sp = typeof variant.sale_price === "object" ? variant.sale_price?.amount : variant.sale_price;
    const cp = typeof variant.cost_price === "object" ? variant.cost_price?.amount : variant.cost_price;

    setVariantFormData({
      sku: variant.sku || "",
      price: p ?? "",
      sale_price: sp ?? "",
      cost_price: cp ?? "",
      stock_quantity: variant.stock_quantity ?? variant.quantity ?? "",
      gtin: variant.gtin || variant.barcode || "",
      mpn: variant.mpn || "",
      weight: variant.weight ?? "",
    });
  };

  // Submit variant edit
  const handleVariantSubmit = async (e) => {
    e.preventDefault();
    if (!editingVariant) return;

    setIsUpdatingVariant(true);
    try {
      await onUpdateVariant?.({
        variantId: editingVariant.id,
        variantData: variantFormData,
      });
      setEditingVariant(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingVariant(false);
    }
  };

  return (
    <div className="editor-section-card" id="section-variants">
      <div className="editor-section-header">
        <div className="section-header-title">
          <div className="section-header-icon">
            <Layers size={18} />
          </div>
          <div>
            <h4 className="section-title">الخيارات والمتغيرات (Options & Variants)</h4>
            <span className="section-desc">
              إدارة خصائص المنتج (المقاسات، الألوان) وأسعار ومخزون كل خيار على حدة.
            </span>
          </div>
        </div>

        <div className="section-header-meta">
          <span
            className={`section-score-pill ${sectionScore?.isComplete ? "section-score-pill--done" : ""}`}
          >
            {sectionScore?.isComplete ? (
              <CheckCircle2 size={13} />
            ) : (
              <AlertCircle size={13} />
            )}
            {sectionScore?.currentScore || 0}/{sectionScore?.targetWeight || 5}%
          </span>

          <Button
            size="small"
            variant="secondary"
            onClick={() => setIsAddOptionOpen(true)}
          >
            <Plus size={13} />
            إضافة خيار جديد
          </Button>
        </div>
      </div>

      <div className="editor-section-body" id="field-options-variants">
        {/* Options List */}
        <div className="options-container">
          <h5 className="sub-section-title">خيارات المنتج الحالية (Attributes)</h5>
          {isOptionsLoading ? (
            <div className="sub-loading-wrap">
              <Loader2 size={16} className="spin" /> جارِ جلب خيارات المنتج...
            </div>
          ) : options.length === 0 ? (
            <div className="empty-sub-card">
              <p>لا توجد خيارات مضافة (مثل: المقاس أو اللون).</p>
              <span>اضغط &quot;إضافة خيار جديد&quot; أعلاه لإنشاء خيارات لهذا المنتج.</span>
            </div>
          ) : (
            <div className="options-cards-list">
              {options.map((opt) => (
                <div key={opt.id} className="option-display-card">
                  <div className="option-card-info">
                    <span className="option-name">{opt.name}</span>
                    <span className="option-type-badge">نوع: {opt.type || "text"}</span>
                  </div>

                  <div className="option-values-chips">
                    {Array.isArray(opt.values) && opt.values.length > 0 ? (
                      opt.values.map((val, idx) => (
                        <span key={val.id || idx} className="option-val-pill">
                          {typeof val === "object" ? val.name : val}
                        </span>
                      ))
                    ) : (
                      <span className="no-values-note">لا توجد قيم مضافة.</span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="delete-opt-btn"
                    onClick={() => onDeleteOption?.(opt.id)}
                    title="حذف الخيار"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-divider-light" />

        {/* Variants / SKUs Table */}
        <div className="variants-container">
          <h5 className="sub-section-title">
            قائمة المتغيرات والمخزون لكل نوع ({variants.length})
          </h5>

          {isVariantsLoading ? (
            <div className="sub-loading-wrap">
              <Loader2 size={16} className="spin" /> جارِ جلب متغيرات المنتج...
            </div>
          ) : variants.length === 0 ? (
            <div className="empty-sub-card">
              <p>هذا المنتج منتج بسيط لا يحتوي على متغيرات (Variants).</p>
              <span>عند إضافة خيارات متعددة، ستقوم سلة تلقائيًا بإنشاء جدول المتغيرات هنا.</span>
            </div>
          ) : (
            <div className="variants-table-wrapper">
              <table className="variants-table">
                <thead>
                  <tr>
                    <th>المتغير / الخيار</th>
                    <th>رمز SKU</th>
                    <th>السعر (ر.س)</th>
                    <th>سعر الخصم</th>
                    <th>سعر التكلفة</th>
                    <th>المخزون</th>
                    <th>GTIN</th>
                    <th>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => {
                    const priceVal =
                      typeof v.price === "object" ? v.price?.amount : v.price;
                    const saleVal =
                      typeof v.sale_price === "object"
                        ? v.sale_price?.amount
                        : v.sale_price;
                    const costVal =
                      typeof v.cost_price === "object"
                        ? v.cost_price?.amount
                        : v.cost_price;
                    const stock = v.stock_quantity ?? v.quantity ?? "—";
                    const variantLabel =
                      v.name ||
                      (Array.isArray(v.related_option_values)
                        ? v.related_option_values.map((x) => x.name).join(" - ")
                        : `متغير #${v.id}`);

                    return (
                      <tr key={v.id}>
                        <td className="variant-name-cell">{variantLabel}</td>
                        <td>{v.sku || "—"}</td>
                        <td className="variant-price-cell">{priceVal ?? "—"}</td>
                        <td>{saleVal ? `${saleVal} ر.س` : "—"}</td>
                        <td>{costVal ? `${costVal} ر.س` : "—"}</td>
                        <td>
                          <span
                            className={`stock-badge ${Number(stock) > 0 ? "stock-badge--instock" : "stock-badge--out"}`}
                          >
                            {stock}
                          </span>
                        </td>
                        <td>{v.gtin || v.barcode || "—"}</td>
                        <td>
                          <button
                            type="button"
                            className="edit-variant-btn"
                            onClick={() => handleOpenEditVariant(v)}
                            title="تعديل بيانات المتغير"
                          >
                            <Pencil size={13} /> تعديل
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: ADD OPTION */}
      {isAddOptionOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddOptionOpen(false)}>
          <div
            className="modal-content modal-content--sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="modal-title">إضافة خيار جديد للمنتج</h3>
                  <span className="modal-subtitle">
                    أنشئ خاصية مثل المقاس أو اللون مع خياراتها المتعددة.
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAddOptionOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOptionSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label required">اسم الخيار</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: المقاس، اللون، السعة"
                  value={optionName}
                  onChange={(e) => setOptionName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">نوع العرض في المتجر</label>
                <select
                  className="form-select"
                  value={optionType}
                  onChange={(e) => setOptionType(e.target.value)}
                >
                  <option value="text">نص (Text)</option>
                  <option value="color">لون (Color)</option>
                  <option value="image">صورة (Image)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label required">
                  قيم الخيار (افصل بينها بفواصل أو سطور)
                </label>
                <textarea
                  rows={3}
                  className="form-textarea"
                  placeholder="مثال: صغير, متوسط, كبير, كبير جداً"
                  value={optionValuesInput}
                  onChange={(e) => setOptionValuesInput(e.target.value)}
                  required
                />
                <span className="form-hint">
                  سيتم إنشاء هذه الخيارات وإتاحتها لإنشاء المتغيرات تلقائيًا.
                </span>
              </div>

              <div className="modal-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsAddOptionOpen(false)}
                >
                  إلغاء
                </Button>
                <Button type="submit" disabled={isCreatingOption}>
                  {isCreatingOption ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  إضافة الخيار
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT VARIANT */}
      {editingVariant && (
        <div className="modal-backdrop" onClick={() => setEditingVariant(null)}>
          <div
            className="modal-content modal-content--md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  <Pencil size={18} />
                </div>
                <div>
                  <h3 className="modal-title">
                    تعديل المتغير: {editingVariant.name || `#${editingVariant.id}`}
                  </h3>
                  <span className="modal-subtitle">
                    تحديث السعر والمخزون والرمز الخاص بهذا المتغير عبر Salla Variants API.
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingVariant(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVariantSubmit} className="modal-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">رمز SKU الخاص بالمتغير</label>
                  <input
                    type="text"
                    className="form-input"
                    value={variantFormData.sku}
                    onChange={(e) =>
                      setVariantFormData((prev) => ({
                        ...prev,
                        sku: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">الكمية / المخزون</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={variantFormData.stock_quantity}
                    onChange={(e) =>
                      setVariantFormData((prev) => ({
                        ...prev,
                        stock_quantity: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">السعر (ر.س)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="form-input"
                    value={variantFormData.price}
                    onChange={(e) =>
                      setVariantFormData((prev) => ({
                        ...prev,
                        price: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">سعر الخصم (ر.س)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="form-input"
                    placeholder="فارغ = لا يوجد خصم"
                    value={variantFormData.sale_price}
                    onChange={(e) =>
                      setVariantFormData((prev) => ({
                        ...prev,
                        sale_price: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">سعر التكلفة (ر.س)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="form-input"
                    value={variantFormData.cost_price}
                    onChange={(e) =>
                      setVariantFormData((prev) => ({
                        ...prev,
                        cost_price: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">رمز GTIN / الباركود</label>
                  <input
                    type="text"
                    className="form-input"
                    value={variantFormData.gtin}
                    onChange={(e) =>
                      setVariantFormData((prev) => ({
                        ...prev,
                        gtin: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">رمز MPN</label>
                  <input
                    type="text"
                    className="form-input"
                    value={variantFormData.mpn}
                    onChange={(e) =>
                      setVariantFormData((prev) => ({
                        ...prev,
                        mpn: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">الوزن (كجم)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="form-input"
                    value={variantFormData.weight}
                    onChange={(e) =>
                      setVariantFormData((prev) => ({
                        ...prev,
                        weight: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="modal-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingVariant(null)}
                >
                  إلغاء
                </Button>
                <Button type="submit" disabled={isUpdatingVariant}>
                  {isUpdatingVariant ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  حفظ المتغير
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
