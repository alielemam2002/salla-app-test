import { useEffect } from "react";
import { Controller, useWatch } from "react-hook-form";
import {
  Alert,
  Checkbox,
  Field,
  FormRow,
  Select,
  TextInput,
} from "../ui/index.js";
import {
  APPLY_ON,
  PRICING_COLUMNS,
  PRICING_FORMULAS,
  SALE_CHANNELS,
  findFormula,
} from "../../utils/bulkActions/bulkActionSpec.js";
import {
  APPLY_ON_LABELS,
  COLUMN_LABELS,
  FORMULA_LABELS,
} from "../../utils/bulkActions/bulkActionUi.js";

/** Radio group bound to a form field. */
function ChoiceGroup({ legend, name, options, register, error }) {
  return (
    <fieldset className="bulk-choice-group">
      <legend className="form-label">{legend}</legend>
      <div className="bulk-choice-options">
        {options.map((opt) => (
          <label key={opt.value} className="bulk-choice">
            <input type="radio" value={opt.value} {...register(name)} />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      {error && <span className="form-error-msg">{error}</span>}
    </fieldset>
  );
}

/** Checkbox list bound to an array field (ids as strings). */
function CheckboxList({ control, name, items, legend, error, emptyText }) {
  return (
    <fieldset className="bulk-choice-group">
      <legend className="form-label">{legend}</legend>
      {items.length === 0 ? (
        <p className="form-hint">{emptyText}</p>
      ) : (
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <div className="bulk-checkbox-list">
              {items.map((item) => {
                const value = String(item.id);
                const checked = field.value.includes(value);
                return (
                  <Checkbox
                    key={value}
                    label={item.name}
                    checked={checked}
                    onChange={(on) =>
                      field.onChange(
                        on
                          ? [...field.value, value]
                          : field.value.filter((v) => v !== value),
                      )
                    }
                  />
                );
              })}
            </div>
          )}
        />
      )}
      {error && <span className="form-error-msg">{error}</span>}
    </fieldset>
  );
}

export function PricingForm({ form, currency }) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;
  const column = useWatch({ control, name: "column" });
  const formulaId = useWatch({ control, name: "formulaId" });
  const formula = findFormula(column, formulaId);

  // Each column has its own documented formulas.
  useEffect(() => {
    if (!findFormula(column, formulaId)) {
      setValue("formulaId", PRICING_FORMULAS[column][0].id);
    }
  }, [column, formulaId, setValue]);

  return (
    <div className="bulk-form">
      <ChoiceGroup
        legend="Apply to"
        name="column"
        register={register}
        options={PRICING_COLUMNS.map((value) => ({
          value,
          label: COLUMN_LABELS[value],
        }))}
      />
      <FormRow>
        <Field label="Change" error={errors.formulaId?.message}>
          <Select
            {...register("formulaId")}
            options={(PRICING_FORMULAS[column] || []).map((f) => ({
              value: f.id,
              label: FORMULA_LABELS[column][f.id],
            }))}
          />
        </Field>
        <Field label="Value" required error={errors.amount?.message}>
          <TextInput
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            suffix={formula?.unit === "percent" ? "%" : currency}
            invalid={Boolean(errors.amount)}
            {...register("amount")}
          />
        </Field>
      </FormRow>
      <ChoiceGroup
        legend="Apply on"
        name="apply_on"
        register={register}
        options={APPLY_ON.map((value) => ({
          value,
          label: APPLY_ON_LABELS[value],
        }))}
      />
      {column === "sale_price" && (
        <p className="form-hint">
          To discount products, Salla sets the sale price below the price. The
          price itself stays the same.
        </p>
      )}
    </div>
  );
}

export function FeaturesForm({ form, field, lookups }) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  return (
    <div className="bulk-form">
      {field === "categories" && (
        <CheckboxList
          control={control}
          name="categories"
          legend="Categories"
          items={lookups.categories}
          error={errors.categories?.message}
          emptyText="No categories found in this store."
        />
      )}
      {field === "brand_id" && (
        <Field label="Brand" required error={errors.brand_id?.message}>
          <Select
            {...register("brand_id")}
            placeholder="Choose a brand"
            options={lookups.brands.map((b) => ({
              value: String(b.id),
              label: b.name,
            }))}
          />
        </Field>
      )}
      {field === "tags" && (
        <CheckboxList
          control={control}
          name="tags"
          legend="Tags"
          items={lookups.tags}
          error={errors.tags?.message}
          emptyText="No product tags found in this store."
        />
      )}
      <Alert tone="info">
        Salla&apos;s docs don&apos;t say whether this adds to or replaces the
        products&apos; current values. Check one product after the operation
        finishes.
      </Alert>
    </div>
  );
}

export function ChannelsForm({ form }) {
  const {
    control,
    formState: { errors },
  } = form;
  const labels = { web: "Web store", app: "Mobile app" };
  return (
    <div className="bulk-form">
      <Controller
        control={control}
        name="channels"
        render={({ field }) => (
          <fieldset className="bulk-choice-group">
            <legend className="form-label">Sell these products on</legend>
            <div className="bulk-checkbox-list">
              {SALE_CHANNELS.map((channel) => (
                <Checkbox
                  key={channel}
                  label={labels[channel]}
                  checked={field.value.includes(channel)}
                  onChange={(on) =>
                    field.onChange(
                      on
                        ? [...field.value, channel]
                        : field.value.filter((c) => c !== channel),
                    )
                  }
                />
              ))}
            </div>
            {errors.channels && (
              <span className="form-error-msg">{errors.channels.message}</span>
            )}
          </fieldset>
        )}
      />
    </div>
  );
}

export function NotifyForm({ form }) {
  const {
    register,
    formState: { errors },
  } = form;
  const number = (name, label, hint, props = {}) => (
    <Field label={label} required hint={hint} error={errors[name]?.message}>
      <TextInput
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        invalid={Boolean(errors[name])}
        {...props}
        {...register(name)}
      />
    </Field>
  );
  return (
    <div className="bulk-form">
      <FormRow columns={3}>
        {number("notify_quantity", "Notify quantity")}
        {number("minimum_notify_quantity", "Minimum notify quantity")}
        {number("subscribers_percentage", "Subscribers percentage", "0–100", {
          max: 100,
          suffix: "%",
        })}
      </FormRow>
    </div>
  );
}
