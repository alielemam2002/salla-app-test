import { Field, FormRow, Switch, TextInput } from "../../ui/index.js";

export default function InventoryFields({
  values,
  errors,
  setField,
  disabled,
}) {
  return (
    <>
      <FormRow columns={3}>
        <Field label="رمز المنتج (SKU)" htmlFor="product-sku">
          <TextInput
            type="text"
            className="font-mono"
            dir="ltr"
            placeholder="TSH-BLU-001"
            value={values.sku}
            onChange={(e) => setField("sku", e.target.value)}
            disabled={disabled}
          />
        </Field>

        <Field
          label="الكمية"
          error={errors.quantity}
          htmlFor="product-quantity"
        >
          <TextInput
            type="number"
            min="0"
            invalid={Boolean(errors.quantity)}
            placeholder={values.unlimited_quantity ? "غير محدود" : "0"}
            value={values.unlimited_quantity ? "" : values.quantity}
            onChange={(e) => setField("quantity", e.target.value)}
            disabled={values.unlimited_quantity || disabled}
          />
        </Field>

        <Field label="أقصى كمية للطلب" htmlFor="product-max-qty">
          <TextInput
            type="number"
            min="1"
            placeholder="بدون حد"
            value={values.maximum_quantity_per_order}
            onChange={(e) =>
              setField("maximum_quantity_per_order", e.target.value)
            }
            disabled={disabled}
          />
        </Field>
      </FormRow>

      <Switch
        className="product-form-switch"
        label="كمية غير محدودة"
        description="لن ينفد المنتج من المخزون"
        checked={values.unlimited_quantity}
        onChange={(checked) => setField("unlimited_quantity", checked)}
        disabled={disabled}
      />
    </>
  );
}
