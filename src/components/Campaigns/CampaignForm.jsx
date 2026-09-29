import { Controller, useFieldArray, useWatch } from "react-hook-form";
import { Plus, X } from "lucide-react";
import {
  Button,
  Field,
  FormRow,
  IconButton,
  Select,
  TextInput,
} from "../ui/index.js";
import { VARIABLE_SOURCES } from "../../utils/campaigns/campaignModel.js";

/**
 * The campaign: an approved WhatsApp template and what goes into each of
 * its {{1}}, {{2}}… (customer name, a coupon code, or custom text).
 */
export default function CampaignForm({ form, coupons, disabled }) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const params = useFieldArray({ control, name: "params" });
  const sources = useWatch({ control, name: "params" }) || [];

  return (
    <fieldset className="campaign-form" disabled={disabled}>
      <Field label="Campaign name" required error={errors.name?.message}>
        <TextInput placeholder="Weekend offer" {...register("name")} />
      </Field>

      <FormRow>
        <Field
          label="Template name"
          required
          hint="An approved Marketing template in WhatsApp Manager"
          error={errors.template?.message}
        >
          <TextInput
            dir="ltr"
            placeholder="offer_ar"
            {...register("template")}
          />
        </Field>
        <Field
          label="Template language"
          required
          error={errors.language?.message}
        >
          <TextInput dir="ltr" placeholder="ar" {...register("language")} />
        </Field>
      </FormRow>

      <div className="campaign-vars">
        <span className="form-label">Template variables, in order</span>
        <p className="form-hint">
          Match your template: {"{{1}}"} is the first variable, {"{{2}}"} the
          second… Leave empty for a template without variables.
        </p>
        {params.fields.map((field, index) => {
          const source = sources[index]?.source;
          const rowError = errors.params?.[index]?.value?.message;
          return (
            <div key={field.id} className="campaign-var-row">
              <span className="wa-param-slot">{`{{${index + 1}}}`}</span>
              <Select
                aria-label={`Type of {{${index + 1}}}`}
                options={VARIABLE_SOURCES}
                {...register(`params.${index}.source`)}
              />
              {source === "coupon_code" && (
                <Select
                  aria-label={`Coupon for {{${index + 1}}}`}
                  placeholder={
                    coupons.length ? "Choose a coupon" : "No active coupons"
                  }
                  options={coupons.map((c) => ({
                    value: c.code,
                    label: c.code,
                  }))}
                  invalid={Boolean(rowError)}
                  {...register(`params.${index}.value`)}
                />
              )}
              {source === "custom" && (
                <Controller
                  control={control}
                  name={`params.${index}.value`}
                  render={({ field: input }) => (
                    <TextInput
                      aria-label={`Text for {{${index + 1}}}`}
                      placeholder="e.g. 20% off everything"
                      maxLength={1000}
                      invalid={Boolean(rowError)}
                      {...input}
                    />
                  )}
                />
              )}
              {source === "customer_name" && (
                <span className="campaign-var-note">Filled per customer</span>
              )}
              <IconButton
                icon={X}
                label={`Remove {{${index + 1}}}`}
                size={14}
                onClick={() => params.remove(index)}
              />
              {rowError && (
                <span className="form-error-msg campaign-var-error">
                  {rowError}
                </span>
              )}
            </div>
          );
        })}
        <Button
          size="small"
          variant="ghost"
          icon={Plus}
          onClick={() => params.append({ source: "customer_name", value: "" })}
          disabled={params.fields.length >= 10}
        >
          Add variable
        </Button>
      </div>
    </fieldset>
  );
}
