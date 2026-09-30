import { Field, FormRow, Select, TextInput, Textarea } from "../../ui/index.js";
import {
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
} from "../../../utils/productConstants.js";

export default function BasicInfoFields({
  values,
  errors,
  setField,
  isEditing,
  disabled,
}) {
  return (
    <>
      <Field
        label="اسم المنتج"
        required
        error={errors.name}
        htmlFor="product-name"
      >
        <TextInput
          type="text"
          invalid={Boolean(errors.name)}
          placeholder="مثال: تيشيرت قطن كلاسيكي"
          value={values.name}
          onChange={(e) => setField("name", e.target.value)}
          disabled={disabled}
        />
      </Field>

      <FormRow>
        <Field
          label="نوع المنتج"
          required={!isEditing}
          htmlFor="product-type"
          hint={
            isEditing
              ? "لا يمكن تغيير نوع المنتج بعد إنشائه (حسب قواعد سلة)."
              : undefined
          }
        >
          <Select
            value={values.product_type}
            onChange={(e) => setField("product_type", e.target.value)}
            disabled={isEditing || disabled}
            options={PRODUCT_TYPES}
          />
        </Field>

        <Field label="الحالة" htmlFor="product-status">
          <Select
            value={values.status}
            onChange={(e) => setField("status", e.target.value)}
            disabled={disabled}
            options={PRODUCT_STATUSES}
          />
        </Field>
      </FormRow>

      <Field label="عنوان فرعي (وصف مختصر)" htmlFor="product-subtitle">
        <TextInput
          type="text"
          placeholder="مثال: مجموعة الصيف المميزة 2026"
          value={values.subtitle}
          onChange={(e) => setField("subtitle", e.target.value)}
          disabled={disabled}
        />
      </Field>

      <Field label="الوصف" htmlFor="product-description">
        <Textarea
          rows={3}
          placeholder="اكتب تفاصيل المنتج ومميزاته…"
          value={values.description}
          onChange={(e) => setField("description", e.target.value)}
          disabled={disabled}
        />
      </Field>
    </>
  );
}
