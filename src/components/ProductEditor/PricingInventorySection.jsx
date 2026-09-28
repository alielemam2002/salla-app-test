import {
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Save,
  TrendingUp,
  TrendingDown,
  Package,
  Barcode,
  Loader2,
  Info,
} from "lucide-react";
import Button from "../forms/Button.jsx";

const CURRENCY_LABELS = { SAR: "ر.س" };

export default function PricingInventorySection({
  register,
  watch,
  errors,
  sectionScore,
  onSaveSection,
  isSaving,
  currency = "SAR",
  managedByBranches = false,
  notifyQuantity,
}) {
  const currencyLabel = CURRENCY_LABELS[currency] || currency;

  const price = Number(watch("price")) || 0;
  const salePrice = Number(watch("sale_price")) || 0;
  const costPrice = Number(watch("cost_price")) || 0;
  const unlimitedQuantity = watch("unlimited_quantity");
  const hasSale = salePrice > 0;

  // Effective selling price (sale price if active, otherwise regular price)
  const effectivePrice = hasSale ? salePrice : price;
  const profit =
    effectivePrice > 0 && costPrice > 0 ? effectivePrice - costPrice : null;
  const margin =
    profit !== null ? Math.round((profit / effectivePrice) * 100) : null;
  const discountPercent =
    hasSale && price > salePrice
      ? Math.round(((price - salePrice) / price) * 100)
      : null;

  const today = new Date().toISOString().slice(0, 10);

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
          <div
            className={`profit-insight-banner ${profit < 0 ? "profit-insight-banner--loss" : ""}`}
          >
            {profit < 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
            <div className="profit-insight-text">
              <span>{profit < 0 ? "خسارة متوقعة: " : "هامش الربح المتوقع: "}</span>
              <strong>
                {Math.abs(profit).toFixed(2)} {currencyLabel}
              </strong>
              <span className="profit-margin-badge">({margin}%)</span>
              <span className="profit-insight-sub">
                (سعر البيع {effectivePrice} {currencyLabel} - التكلفة {costPrice}{" "}
                {currencyLabel})
              </span>
            </div>
          </div>
        )}

        {/* Pricing Fields (Row of 3) */}
        <div className="form-row-3">
          {/* Regular Price */}
          <div className="form-group" id="field-price">
            <label className="form-label required">
              السعر الأساسي ({currencyLabel})
            </label>
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
            <label className="form-label">
              سعر التخفيض (اختياري)
              {discountPercent !== null && (
                <span className="discount-badge">-{discountPercent}%</span>
              )}
            </label>
            <input
              type="number"
              step="any"
              min="0"
              className={`form-input ${errors?.sale_price ? "form-input--error" : ""}`}
              placeholder="0.00"
              {...register("sale_price", {
                validate: (value, values) =>
                  value === "" ||
                  Number(value) === 0 ||
                  Number(value) < Number(values.price) ||
                  "سعر التخفيض يجب أن يكون أقل من السعر الأساسي",
              })}
            />
            {errors?.sale_price ? (
              <span className="form-error-msg">{errors.sale_price.message}</span>
            ) : (
              <span className="form-hint">اتركه فارغًا إذا لم يكن هناك خصم.</span>
            )}
          </div>

          {/* Cost Price */}
          <div className="form-group" id="field-cost_price">
            <label className="form-label">سعر التكلفة ({currencyLabel})</label>
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

        {/* Sale end date (only meaningful when a sale price is set) */}
        {hasSale && (
          <div className="form-row-2">
            <div className="form-group" id="field-sale_end">
              <label className="form-label">تاريخ انتهاء التخفيض (اختياري)</label>
              <input
                type="date"
                min={today}
                className={`form-input ${errors?.sale_end ? "form-input--error" : ""}`}
                {...register("sale_end", {
                  validate: (value) =>
                    !value ||
                    value >= today ||
                    "تاريخ انتهاء التخفيض يجب أن يكون اليوم أو بعده",
                })}
              />
              {errors?.sale_end ? (
                <span className="form-error-msg">{errors.sale_end.message}</span>
              ) : (
                <span className="form-hint">
                  يعود المنتج لسعره الأساسي تلقائيًا بعد هذا التاريخ. اتركه فارغًا
                  ليستمر التخفيض.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Inventory Fields */}
        <div className="form-row-2">
          {/* Quantity */}
          <div className="form-group" id="field-quantity">
            <div className="form-label-row">
              <label className="form-label">
                <Package size={14} style={{ display: "inline" }} /> الكمية المتاحة في المخزون
              </label>
              <label className="unlimited-checkbox-label">
                <input type="checkbox" {...register("unlimited_quantity")} />
                <span>كمية لا نهائية (غير محدودة)</span>
              </label>
            </div>
            <input
              type="number"
              min="0"
              step="1"
              readOnly={unlimitedQuantity}
              className={`form-input ${unlimitedQuantity ? "form-input--disabled" : ""} ${errors?.quantity ? "form-input--error" : ""}`}
              placeholder={unlimitedQuantity ? "غير محدود (∞)" : "0"}
              {...register("quantity", {
                validate: (value, values) =>
                  values.unlimited_quantity ||
                  value === "" ||
                  (Number.isInteger(Number(value)) && Number(value) >= 0) ||
                  "الكمية يجب أن تكون رقمًا صحيحًا موجبًا",
              })}
            />
            {errors?.quantity ? (
              <span className="form-error-msg">{errors.quantity.message}</span>
            ) : managedByBranches ? (
              <span className="form-hint form-hint--warn">
                <Info size={12} style={{ display: "inline" }} /> مخزون هذا المنتج
                يُدار حسب الفروع، وقد لا تنعكس الكمية المُدخلة هنا. عدّلها من
                لوحة سلة لكل فرع.
              </span>
            ) : (
              notifyQuantity && (
                <span className="form-hint">
                  تنبيه انخفاض المخزون عند: {notifyQuantity} (يُعدَّل من لوحة سلة)
                </span>
              )
            )}
          </div>

          {/* Max quantity per order */}
          <div className="form-group" id="field-maximum_quantity_per_order">
            <label className="form-label">الحد الأقصى للكمية في الطلب الواحد</label>
            <input
              type="number"
              min="0"
              step="1"
              className="form-input"
              placeholder="0 = بدون حد"
              {...register("maximum_quantity_per_order")}
            />
            <label className="unlimited-checkbox-label">
              <input type="checkbox" {...register("hide_quantity")} />
              <span>إخفاء الكمية المتبقية عن العملاء</span>
            </label>
          </div>
        </div>

        {/* Codes */}
        <div className="form-row-3">
          {/* SKU */}
          <div className="form-group" id="field-sku">
            <label className="form-label">رمز المنتج (SKU)</label>
            <input
              type="text"
              dir="ltr"
              className="form-input"
              placeholder="PROD-1001-BLU"
              {...register("sku")}
            />
            <span className="form-hint">رمز تعريفي فريد للمنتج يساعد في إدارة المستودعات.</span>
          </div>

          {/* GTIN / Barcode */}
          <div className="form-group" id="field-gtin">
            <label className="form-label">
              <Barcode size={14} style={{ display: "inline" }} /> الباركود (GTIN)
            </label>
            <input
              type="text"
              dir="ltr"
              inputMode="numeric"
              className={`form-input ${errors?.gtin ? "form-input--error" : ""}`}
              placeholder="6281000123456"
              {...register("gtin", {
                validate: (value) =>
                  !value ||
                  /^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value.trim()) ||
                  "GTIN يتكون من 8 أو 12 أو 13 أو 14 رقمًا",
              })}
            />
            {errors?.gtin ? (
              <span className="form-error-msg">{errors.gtin.message}</span>
            ) : (
              <span className="form-hint">
                UPC / EAN لتسهيل البيع عبر Google Shopping.
              </span>
            )}
          </div>

          {/* MPN */}
          <div className="form-group" id="field-mpn">
            <label className="form-label">رقم القطعة للمصنّع (MPN)</label>
            <input
              type="text"
              dir="ltr"
              className="form-input"
              placeholder="MPN-998877"
              {...register("mpn")}
            />
            <span className="form-hint">رقم مميز مخصص من قبل الشركة المصنعة.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
