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
      <Field label="العلامة التجارية" htmlFor="product-brand">
        {brands.length > 0 ? (
          <Select
            value={values.brand_id}
            onChange={(e) => setField("brand_id", e.target.value)}
            disabled={disabled}
            placeholder="— بدون علامة تجارية —"
            options={brands.map((b) => ({
              value: b.id,
              label: `${b.name} (#${b.id})`,
            }))}
          />
        ) : (
          <TextInput
            type="number"
            placeholder="أدخل معرّف العلامة التجارية (اختياري)"
            value={values.brand_id}
            onChange={(e) => setField("brand_id", e.target.value)}
            disabled={disabled}
          />
        )}
      </Field>

      {categories.length > 0 && (
        <fieldset className="form-group product-categories-fieldset">
          <legend className="form-label">التصنيفات</legend>
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
                  <span className="category-item-id" dir="ltr">
                    #{cat.id}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <Field
        label="معرّفات التصنيفات (مفصولة بفاصلة)"
        htmlFor="manual-category-ids"
        hint="أدخل معرّفات التصنيفات في سلة مباشرة."
      >
        <TextInput
          type="text"
          className="font-mono"
          dir="ltr"
          placeholder="10293847, 59283741"
          value={values.manualCategoryIds}
          onChange={(e) => setField("manualCategoryIds", e.target.value)}
          disabled={disabled}
        />
      </Field>

      <Switch
        className="product-form-switch"
        label="يتطلب شحنًا"
        description="يُوصَّل المنتج فعليًا إلى العميل"
        checked={values.require_shipping}
        onChange={(checked) => setField("require_shipping", checked)}
        disabled={disabled}
      />

      {values.require_shipping && (
        <FormRow>
          <Field label="الوزن" htmlFor="product-weight">
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
          <Field label="وحدة الوزن" htmlFor="product-weight-unit">
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
