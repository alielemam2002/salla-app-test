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
        label="Product Name"
        required
        error={errors.name}
        htmlFor="product-name"
      >
        <TextInput
          type="text"
          invalid={Boolean(errors.name)}
          placeholder="e.g. Classic Cotton T-Shirt"
          value={values.name}
          onChange={(e) => setField("name", e.target.value)}
          disabled={disabled}
        />
      </Field>

      <FormRow>
        <Field
          label="Product Type"
          required={!isEditing}
          htmlFor="product-type"
          hint={
            isEditing
              ? "Product type cannot be changed after creation per Salla API rules."
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

        <Field label="Status" htmlFor="product-status">
          <Select
            value={values.status}
            onChange={(e) => setField("status", e.target.value)}
            disabled={disabled}
            options={PRODUCT_STATUSES}
          />
        </Field>
      </FormRow>

      <Field label="Subtitle / Short Tagline" htmlFor="product-subtitle">
        <TextInput
          type="text"
          placeholder="e.g. Premium Summer Collection 2026"
          value={values.subtitle}
          onChange={(e) => setField("subtitle", e.target.value)}
          disabled={disabled}
        />
      </Field>

      <Field label="Description" htmlFor="product-description">
        <Textarea
          rows={3}
          placeholder="Detailed information about the product..."
          value={values.description}
          onChange={(e) => setField("description", e.target.value)}
          disabled={disabled}
        />
      </Field>
    </>
  );
}
