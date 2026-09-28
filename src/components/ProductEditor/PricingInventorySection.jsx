import {
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Save,
  TrendingUp,
  Package,
  Barcode,
  Loader2,
} from "lucide-react";
import Button from "../forms/Button.jsx";

export default function PricingInventorySection({
  register,
  watch,
  errors,
  sectionScore,
  onSaveSection,
  isSaving,
}) {
  const price = Number(watch("price")) || 0;
  const salePrice = watch("sale_price") !== "" && watch("sale_price") !== null ? Number(watch("sale_price")) : null;
  const costPrice = Number(watch("cost_price")) || 0;
  const unlimitedQuantity = watch("unlimited_quantity");

  // Effective selling price (sale price if active, otherwise regular price)
  const effectivePrice = salePrice !== null && !isNaN(salePrice) && salePrice > 0 ? salePrice : price;
  const profit = effectivePrice > 0 && costPrice > 0 ? effectivePrice - costPrice : null;
  const margin = profit !== null && effectivePrice > 0 ? Math.round((profit / effectivePrice) * 100) : null;

  return (
    <div className="editor-section-card" id="section-pricingInventory">
      <div className="editor-section-header">
        <div className="section-header-title">
          <div className="section-header-icon">
            <DollarSign size={18} />
          </div>
          <div>
            <h4 className="section-title">السعر والمخزون والرموز</h4>
            <span className="section-desc">
              أسعار البيع والتكلفة، إدارة المخزون، ورموز التتبع (SKU, GTIN, MPN).
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
            onClick={onSaveSection}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
            حفظ الأسعار
          </Button>
        </div>
      </div>

      <div className="editor-section-body">
        {/* Profitability insight banner if cost and price entered */}
        {profit !== null && (
          <div className="profit-insight-banner">
            <TrendingUp size={16} />
            <div className="profit-insight-text">
              <span>هامش الربح المتوقع: </span>
              <strong>{profit.toFixed(2)} ر.س</strong>
              <span className="profit-margin-badge">({margin}%)</span>
              <span className="profit-insight-sub">
                (سعر البيع {effectivePrice} ر.س - التكلفة {costPrice} ر.س)
              </span>
            </div>
          </div>
        )}

        {/* Pricing Fields (Row of 3) */}
        <div className="form-row-3">
          {/* Regular Price */}
          <div className="form-group" id="field-price">
            <label className="form-label required">السعر الأساسي (ر.س)</label>
            <input
              type="number"
              step="any"
              min="0"
              className={`form-input ${errors?.price ? "form-input--error" : ""}`}
              placeholder="0.00"
              {...register("price", {
                required: "السعر الأساسي مطلوب",
                min: { value: 0, message: "السعر لا يمكن أن يكون سالبًا" },
              })}
            />
            {errors?.price && (
              <span className="form-error-msg">{errors.price.message}</span>
            )}
          </div>

          {/* Sale Price */}
          <div className="form-group" id="field-sale_price">
            <label className="form-label">سعر التخفيض (اختياري)</label>
            <input
              type="number"
              step="any"
              min="0"
              className="form-input"
              placeholder="0.00"
              {...register("sale_price")}
            />
            <span className="form-hint">اتركه فارغًا إذا لم يكن هناك خصم.</span>
          </div>

          {/* Cost Price */}
          <div className="form-group" id="field-cost_price">
            <label className="form-label">سعر التكلفة (ر.س)</label>
            <input
              type="number"
              step="any"
              min="0"
              className="form-input"
              placeholder="0.00"
              {...register("cost_price")}
            />
            <span className="form-hint">يساعدك في حساب الأرباح ولا يظهر للعملاء.</span>
          </div>
        </div>

        {/* Inventory Fields */}
        <div className="form-row-2">
          {/* Quantity */}
          <div className="form-group" id="field-quantity">
            <div className="form-label-row">
              <label className="form-label">
                <Package size={14} style={{ display: "inline" }} /> الكمية المتاحة في المخزون
              </label>
              <label className="unlimited-checkbox-label">
                <input
                  type="checkbox"
                  {...register("unlimited_quantity")}
                />
                <span>كمية لا نهائية (غير محدودة)</span>
              </label>
            </div>
            <input
              type="number"
              min="0"
              disabled={unlimitedQuantity}
              className={`form-input ${unlimitedQuantity ? "form-input--disabled" : ""}`}
              placeholder={unlimitedQuantity ? "غير محدود (∞)" : "0"}
              {...register("quantity")}
            />
          </div>

          {/* SKU */}
          <div className="form-group" id="field-sku">
            <label className="form-label">رمز المنتج (SKU)</label>
            <input
              type="text"
              className="form-input"
              placeholder="مثال: PROD-1001-BLU"
              {...register("sku")}
            />
            <span className="form-hint">رمز تعريفي فريد للمنتج يساعد في إدارة المستودعات.</span>
          </div>
        </div>

        {/* Barcode & Manufacturer Identifiers */}
        <div className="form-row-2">
          {/* GTIN / Barcode */}
          <div className="form-group" id="field-gtin">
            <label className="form-label">
              <Barcode size={14} style={{ display: "inline" }} /> رمز الباركود الدولي (GTIN / Barcode)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="مثال: 6281000123456"
              {...register("gtin")}
            />
            <span className="form-hint">
              رمز GTIN / UPC / EAN لتسهيل البيع عبر Google Shopping ومنصات المقارنة.
            </span>
          </div>

          {/* MPN */}
          <div className="form-group" id="field-mpn">
            <label className="form-label">رقم القطعة للمصنّع (MPN)</label>
            <input
              type="text"
              className="form-input"
              placeholder="مثال: MPN-998877"
              {...register("mpn")}
            />
            <span className="form-hint">
              رقم مميز مخصص من قبل الشركة المصنعة للمنتج.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
