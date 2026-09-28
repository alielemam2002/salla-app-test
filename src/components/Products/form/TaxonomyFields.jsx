import {
  Field,
  FormRow,
  Select,
  Switch,
  TextInput,
  cx,
} from "../../ui/index.js";
import { WEIGHT_TYPES } from "../../../utils/productConstants.js";

/** Brand, categories (chips + manual ids) and shipping/weight. */
export default function TaxonomyFields({
  values,
  setField,
  toggleCategory,
  categories,
  brands,
  disabled,
}) {
  return (
    <>
      <Field label="Brand" htmlFor="product-brand">
        {brands.length > 0 ? (
          <Select
            value={values.brand_id}
            onChange={(e) => setField("brand_id", e.target.value)}
            disabled={disabled}
            placeholder="-- None (No Brand) --"
            options={brands.map((b) => ({
              value: b.id,
              label: `${b.name} (#${b.id})`,
            }))}
          />
        ) : (
          <TextInput
            type="number"
            placeholder="Enter Brand ID (optional)"
            value={values.brand_id}
            onChange={(e) => setField("brand_id", e.target.value)}
            disabled={disabled}
          />
        )}
      </Field>

      {categories.length > 0 && (
        <fieldset className="form-group product-categories-fieldset">
          <legend className="form-label">Categories</legend>
          <div className="categories-selection-list">
            {categories.map((cat) => {
              const isChecked = values.categories.includes(cat.id);
              return (
                <label
                  key={cat.id}
                  className={cx(
                    "category-item-checkbox",
                    isChecked && "active",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCategory(cat.id)}
                    disabled={disabled}
                  />
                  <span>{cat.name}</span>
                  <span className="category-item-id">#{cat.id}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <Field
        label="Category IDs (comma-separated)"
        htmlFor="manual-category-ids"
        hint="Enter Salla Category IDs directly."
      >
        <TextInput
          type="text"
          className="font-mono"
          placeholder="e.g. 10293847, 59283741"
          value={values.manualCategoryIds}
          onChange={(e) => setField("manualCategoryIds", e.target.value)}
          disabled={disabled}
        />
      </Field>

      <Switch
        className="product-form-switch"
        label="Requires Shipping"
        description="Physical delivery to the customer"
        checked={values.require_shipping}
        onChange={(checked) => setField("require_shipping", checked)}
        disabled={disabled}
      />

      {values.require_shipping && (
        <FormRow>
          <Field label="Weight" htmlFor="product-weight">
            <TextInput
              type="number"
              step="any"
              min="0"
              placeholder="0.5"
              value={values.weight}
              onChange={(e) => setField("weight", e.target.value)}
              disabled={disabled}
            />
          </Field>
          <Field label="Weight Unit" htmlFor="product-weight-unit">
            <Select
              value={values.weight_type}
              onChange={(e) => setField("weight_type", e.target.value)}
              disabled={disabled}
              options={WEIGHT_TYPES}
            />
          </Field>
        </FormRow>
      )}
    </>
  );
}
