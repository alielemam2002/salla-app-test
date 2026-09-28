import { DollarSign, Info } from "lucide-react";
import { Badge, FormRow, TextInput } from "../ui/index.js";
import EditorSection from "./EditorSection.jsx";
import EditorField from "./EditorField.jsx";
import ProfitInsight from "./ProfitInsight.jsx";
import { computePricingInsight } from "../../utils/productEditorForm.js";

const CURRENCY_LABELS = { SAR: "ر.س" };
const GTIN_PATTERN = /^(\d{8}|\d{12}|\d{13}|\d{14})$/;

function InlineCheckbox({ label, ...inputProps }) {
  return (
    <label className="editor-inline-checkbox">
      <input type="checkbox" {...inputProps} />
      <span>{label}</span>
    </label>
  );
}

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
  const unlimitedQuantity = watch("unlimited_quantity");
  const insight = computePricingInsight({
    price: watch("price"),
    salePrice: watch("sale_price"),
    costPrice: watch("cost_price"),
  });
  const today = new Date().toISOString().slice(0, 10);

  let quantityHint;
  if (managedByBranches) {
    quantityHint = (
      <span className="form-hint--warn">
        <Info size={12} aria-hidden="true" /> مخزون هذا المنتج يُدار حسب الفروع،
        وقد لا تنعكس الكمية المُدخلة هنا. عدّلها من لوحة سلة لكل فرع.
      </span>
    );
  } else if (notifyQuantity) {
    quantityHint = `تنبيه انخفاض المخزون عند: ${notifyQuantity} (يُعدَّل من لوحة سلة)`;
  }

  return (
    <EditorSection
      id="section-pricingInventory"
      icon={DollarSign}
      title="السعر والمخزون والرموز"
      description="أسعار البيع والتكلفة، إدارة المخزون، ورموز التتبع (SKU, GTIN, MPN)."
      score={sectionScore}
      fallbackWeight={5}
      saveLabel="حفظ الأسعار"
      onSave={onSaveSection}
      isSaving={isSaving}
    >
      <ProfitInsight {...insight} currencyLabel={currencyLabel} />

      <h5 className="editor-subheading">التسعير</h5>
      <FormRow columns={3}>
        <EditorField
          anchor="price"
          label={`السعر الأساسي (${currencyLabel})`}
          required
          error={errors?.price?.message}
        >
          <TextInput
            type="number"
            step="any"
            min="0"
            dir="ltr"
            invalid={Boolean(errors?.price)}
            placeholder="0.00"
            suffix={currencyLabel}
            {...register("price", {
              required: "السعر الأساسي مطلوب",
              min: { value: 0, message: "السعر لا يمكن أن يكون سالبًا" },
            })}
          />
        </EditorField>

        <EditorField
          anchor="sale_price"
          label="سعر التخفيض (اختياري)"
          labelExtra={
            insight.discountPercent !== null && (
              <Badge tone="danger">-{insight.discountPercent}%</Badge>
            )
          }
          error={errors?.sale_price?.message}
          hint="اتركه فارغًا إذا لم يكن هناك خصم."
        >
          <TextInput
            type="number"
            step="any"
            min="0"
            dir="ltr"
            invalid={Boolean(errors?.sale_price)}
            placeholder="0.00"
            suffix={currencyLabel}
            {...register("sale_price", {
              validate: (value, values) =>
                value === "" ||
                Number(value) === 0 ||
                Number(value) < Number(values.price) ||
                "سعر التخفيض يجب أن يكون أقل من السعر الأساسي",
            })}
          />
        </EditorField>

        <EditorField
          anchor="cost_price"
          label={`سعر التكلفة (${currencyLabel})`}
          hint="يساعدك في حساب الأرباح ولا يظهر للعملاء."
        >
          <TextInput
            type="number"
            step="any"
            min="0"
            dir="ltr"
            placeholder="0.00"
            suffix={currencyLabel}
            {...register("cost_price")}
          />
        </EditorField>
      </FormRow>

      {/* Sale end date is only meaningful when a sale price is set */}
      {insight.hasSale && (
        <FormRow>
          <EditorField
            anchor="sale_end"
            label="تاريخ انتهاء التخفيض (اختياري)"
            error={errors?.sale_end?.message}
            hint="يعود المنتج لسعره الأساسي تلقائيًا بعد هذا التاريخ. اتركه فارغًا ليستمر التخفيض."
          >
            <TextInput
              type="date"
              min={today}
              invalid={Boolean(errors?.sale_end)}
              {...register("sale_end", {
                validate: (value) =>
                  !value ||
                  value >= today ||
                  "تاريخ انتهاء التخفيض يجب أن يكون اليوم أو بعده",
              })}
            />
          </EditorField>
        </FormRow>
      )}

      <h5 className="editor-subheading">المخزون</h5>
      <FormRow>
        <EditorField
          anchor="quantity"
          label="الكمية المتاحة في المخزون"
          labelExtra={
            <InlineCheckbox
              label="كمية لا نهائية (غير محدودة)"
              {...register("unlimited_quantity")}
            />
          }
          error={errors?.quantity?.message}
          hint={quantityHint}
        >
          <TextInput
            type="number"
            min="0"
            step="1"
            dir="ltr"
            readOnly={unlimitedQuantity}
            invalid={Boolean(errors?.quantity)}
            className={unlimitedQuantity ? "form-input--readonly" : ""}
            placeholder={unlimitedQuantity ? "غير محدود (∞)" : "0"}
            {...register("quantity", {
              validate: (value, values) =>
                values.unlimited_quantity ||
                value === "" ||
                (Number.isInteger(Number(value)) && Number(value) >= 0) ||
                "الكمية يجب أن تكون رقمًا صحيحًا موجبًا",
            })}
          />
        </EditorField>

        <div id="field-maximum_quantity_per_order" className="editor-field">
          <div className="form-group">
            <label className="form-label" htmlFor="editor-max-qty">
              الحد الأقصى للكمية في الطلب الواحد
            </label>
            <TextInput
              id="editor-max-qty"
              type="number"
              min="0"
              step="1"
              dir="ltr"
              placeholder="0 = بدون حد"
              {...register("maximum_quantity_per_order")}
            />
            <InlineCheckbox
              label="إخفاء الكمية المتبقية عن العملاء"
              {...register("hide_quantity")}
            />
          </div>
        </div>
      </FormRow>

      <h5 className="editor-subheading">رموز التتبع</h5>
      <FormRow columns={3}>
        <EditorField
          anchor="sku"
          label="رمز المنتج (SKU)"
          hint="رمز تعريفي فريد للمنتج يساعد في إدارة المستودعات."
        >
          <TextInput
            type="text"
            dir="ltr"
            placeholder="PROD-1001-BLU"
            {...register("sku")}
          />
        </EditorField>

        <EditorField
          anchor="gtin"
          label="الباركود (GTIN)"
          error={errors?.gtin?.message}
          hint="UPC / EAN لتسهيل البيع عبر Google Shopping."
        >
          <TextInput
            type="text"
            dir="ltr"
            inputMode="numeric"
            invalid={Boolean(errors?.gtin)}
            placeholder="6281000123456"
            {...register("gtin", {
              validate: (value) =>
                !value ||
                GTIN_PATTERN.test(value.trim()) ||
                "GTIN يتكون من 8 أو 12 أو 13 أو 14 رقمًا",
            })}
          />
        </EditorField>

        <EditorField
          anchor="mpn"
          label="رقم القطعة للمصنّع (MPN)"
          hint="رقم مميز مخصص من قبل الشركة المصنعة."
        >
          <TextInput
            type="text"
            dir="ltr"
            placeholder="MPN-998877"
            {...register("mpn")}
          />
        </EditorField>
      </FormRow>
    </EditorSection>
  );
}
