import { Calendar, DollarSign, Percent, X } from "lucide-react";
import {
  Field,
  FormRow,
  IconButton,
  SectionHeader,
  TextInput,
  cx,
} from "../ui/index.js";

const TYPES = [
  { id: "percentage", label: "نسبة مئوية (%)", icon: Percent },
  { id: "fixed", label: "مبلغ ثابت (SAR)", icon: DollarSign },
];

/** Step 2 (apply mode): discount type, value and optional end date. */
export default function DiscountConfigStep({
  discountType,
  onTypeChange,
  discountValue,
  onValueChange,
  saleEndDate,
  onSaleEndDateChange,
  disabled,
}) {
  const isPercent = discountType === "percentage";
  const today = new Date().toISOString().split("T")[0];

  return (
    <section className="form-section">
      <SectionHeader title="2. إعداد الخصم" />
      <FormRow>
        <div className="form-group">
          <span className="form-label" id="discount-type-label">
            نوع الخصم
          </span>
          <div
            className="discount-type-group"
            role="group"
            aria-labelledby="discount-type-label"
          >
            {TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={discountType === id}
                className={cx(
                  "discount-type-btn",
                  discountType === id && "active",
                )}
                onClick={() => onTypeChange(id)}
                disabled={disabled}
              >
                <Icon size={15} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        </div>

        <Field
          label={isPercent ? "نسبة الخصم" : "مبلغ الخصم (SAR)"}
          htmlFor="discount-val"
        >
          <TextInput
            type="number"
            step="any"
            min="0.1"
            max={isPercent ? "100" : undefined}
            inputMode="decimal"
            placeholder={isPercent ? "20" : "15"}
            value={discountValue}
            onChange={(e) => onValueChange(e.target.value)}
            disabled={disabled}
            suffix={isPercent ? "%" : "SAR"}
          />
        </Field>
      </FormRow>

      <Field
        label="تاريخ انتهاء التخفيض (اختياري)"
        htmlFor="sale-end-date"
        hint="اتركه فارغًا إذا لم يكن للعرض تاريخ انتهاء محدد."
      >
        <TextInput
          type="date"
          value={saleEndDate}
          min={today}
          onChange={(e) => onSaleEndDateChange(e.target.value)}
          disabled={disabled}
          prefix={<Calendar size={15} aria-hidden="true" />}
          suffix={
            saleEndDate ? (
              <IconButton
                icon={X}
                size={14}
                label="مسح التاريخ"
                className="input-clear-btn"
                onClick={() => onSaleEndDateChange("")}
              />
            ) : null
          }
        />
      </Field>
    </section>
  );
}
