import { Field, FormRow, TextInput } from "../../ui/index.js";

const FIELDS = [
  {
    name: "price",
    id: "product-price",
    label: "Regular Price (SAR)",
    required: true,
    placeholder: "0.00",
  },
  {
    name: "sale_price",
    id: "product-sale-price",
    label: "Sale Price (SAR)",
    placeholder: "Optional discounted price",
  },
  {
    name: "cost_price",
    id: "product-cost-price",
    label: "Cost Price (SAR)",
    placeholder: "Wholesale/cost",
  },
];

export default function PricingFields({ values, errors, setField, disabled }) {
  return (
    <FormRow columns={3}>
      {FIELDS.map(({ name, id, label, required, placeholder }) => (
        <Field
          key={name}
          label={label}
          required={required}
          error={errors[name]}
          htmlFor={id}
        >
          <TextInput
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            invalid={Boolean(errors[name])}
            placeholder={placeholder}
            value={values[name]}
            onChange={(e) => setField(name, e.target.value)}
            disabled={disabled}
          />
        </Field>
      ))}
    </FormRow>
  );
}
