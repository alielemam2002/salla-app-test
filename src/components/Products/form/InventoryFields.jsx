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
        <Field label="SKU (Stock Keeping Unit)" htmlFor="product-sku">
          <TextInput
            type="text"
            className="font-mono"
            placeholder="e.g. TSH-BLU-001"
            value={values.sku}
            onChange={(e) => setField("sku", e.target.value)}
            disabled={disabled}
          />
        </Field>

        <Field
          label="Stock Quantity"
          error={errors.quantity}
          htmlFor="product-quantity"
        >
          <TextInput
            type="number"
            min="0"
            invalid={Boolean(errors.quantity)}
            placeholder={values.unlimited_quantity ? "Unlimited" : "0"}
            value={values.unlimited_quantity ? "" : values.quantity}
            onChange={(e) => setField("quantity", e.target.value)}
            disabled={values.unlimited_quantity || disabled}
          />
        </Field>

        <Field label="Max Qty / Order" htmlFor="product-max-qty">
          <TextInput
            type="number"
            min="1"
            placeholder="No limit"
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
        label="Unlimited Quantity"
        description="Never runs out of stock"
        checked={values.unlimited_quantity}
        onChange={(checked) => setField("unlimited_quantity", checked)}
        disabled={disabled}
      />
    </>
  );
}
