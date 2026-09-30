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
  CHANNEL_LABELS,
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
        legend="تطبيق على"
        name="column"
        register={register}
        options={PRICING_COLUMNS.map((value) => ({
          value,
          label: COLUMN_LABELS[value],
        }))}
      />
      <FormRow>
        <Field label="التغيير" error={errors.formulaId?.message}>
          <Select
            {...register("formulaId")}
            options={(PRICING_FORMULAS[column] || []).map((f) => ({
              value: f.id,
              label: FORMULA_LABELS[column][f.id],
            }))}
          />
        </Field>
        <Field label="القيمة" required error={errors.amount?.message}>
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
        legend="نطاق التطبيق"
        name="apply_on"
        register={register}
        options={APPLY_ON.map((value) => ({
          value,
          label: APPLY_ON_LABELS[value],
        }))}
      />
      {column === "sale_price" && (
        <p className="form-hint">
          لتطبيق خصم، تضبط سلة سعر التخفيض أقل من السعر، ويبقى السعر الأساسي كما
          هو.
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
          legend="التصنيفات"
          items={lookups.categories}
          error={errors.categories?.message}
          emptyText="لا توجد تصنيفات في هذا المتجر."
        />
      )}
      {field === "brand_id" && (
        <Field
          label="العلامة التجارية"
          required
          error={errors.brand_id?.message}
        >
          <Select
            {...register("brand_id")}
            placeholder="اختر علامة تجارية"
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
          legend="الوسوم"
          items={lookups.tags}
          error={errors.tags?.message}
          emptyText="لا توجد وسوم منتجات في هذا المتجر."
        />
      )}
      <Alert tone="info">
        لا توضح وثائق سلة هل تُضاف هذه القيم إلى قيم المنتجات الحالية أم
        تستبدلها. تحقق من أحد المنتجات بعد اكتمال العملية.
      </Alert>
    </div>
  );
}

export function ChannelsForm({ form }) {
  const {
    control,
    formState: { errors },
  } = form;
  const labels = CHANNEL_LABELS;
  return (
    <div className="bulk-form">
      <Controller
        control={control}
        name="channels"
        render={({ field }) => (
          <fieldset className="bulk-choice-group">
            <legend className="form-label">بيع هذه المنتجات عبر</legend>
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
        {number("notify_quantity", "كمية التنبيه")}
        {number("minimum_notify_quantity", "الحد الأدنى لكمية التنبيه")}
        {number("subscribers_percentage", "نسبة المشتركين", "من 0 إلى 100", {
          max: 100,
          suffix: "%",
        })}
      </FormRow>
    </div>
  );
}
