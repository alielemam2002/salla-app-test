import { Controller, useWatch } from "react-hook-form";
import { Field, Select, TextInput } from "../ui/index.js";
import TemplatePicker from "../whatsapp/TemplatePicker.jsx";
import { BINDING_SOURCES } from "../../utils/whatsapp/templateBinding.js";
import { usesCoupon } from "../../utils/campaigns/campaignModel.js";

/**
 * The campaign: a name, one of the merchant's approved templates (Settings
 * → library read from Meta) with what fills each variable, and the coupon
 * when the template shows one.
 */
export default function CampaignForm({
  form,
  coupons,
  templates,
  onOpenSettings,
  disabled,
}) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const binding = useWatch({ control, name: "binding" });
  const needsCoupon = usesCoupon(binding?.slots || []);
  // "Pick a template" (schema) or the library check (setError on binding).
  const bindingError =
    errors.binding?.message || errors.binding?.templateId?.message;

  return (
    <fieldset className="campaign-form" disabled={disabled}>
      <Field label="اسم الحملة" required error={errors.name?.message}>
        <TextInput placeholder="عرض نهاية الأسبوع" {...register("name")} />
      </Field>

      <Controller
        control={control}
        name="binding"
        render={({ field }) => (
          <TemplatePicker
            label="قالب الحملة (تسويقي معتمد)"
            templates={templates}
            value={field.value}
            onChange={field.onChange}
            sources={BINDING_SOURCES.campaign}
            onOpenSettings={onOpenSettings}
            disabled={disabled}
          />
        )}
      />
      {bindingError && (
        <span className="form-error-msg" role="alert">
          {bindingError}
        </span>
      )}

      {needsCoupon && (
        <Field
          label="كوبون الحملة"
          required
          hint="يظهر في مكان «كود كوبون الحملة» في القالب."
          error={errors.couponCode?.message}
        >
          <Select
            placeholder={
              coupons.length ? "اختر كوبونًا" : "لا توجد كوبونات نشطة"
            }
            options={coupons.map((c) => ({ value: c.code, label: c.code }))}
            {...register("couponCode")}
          />
        </Field>
      )}
    </fieldset>
  );
}
