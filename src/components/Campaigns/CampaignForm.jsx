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
      <Field label="اسم الحملة" required error={errors.name?.message}>
        <TextInput placeholder="عرض نهاية الأسبوع" {...register("name")} />
      </Field>

      <FormRow>
        <Field
          label="اسم القالب"
          required
          hint="قالب تسويقي (Marketing) معتمد في مدير واتساب (WhatsApp Manager)"
          error={errors.template?.message}
        >
          <TextInput
            dir="ltr"
            placeholder="offer_ar"
            {...register("template")}
          />
        </Field>
        <Field label="لغة القالب" required error={errors.language?.message}>
          <TextInput dir="ltr" placeholder="ar" {...register("language")} />
        </Field>
      </FormRow>

      <div className="campaign-vars">
        <span className="form-label">متغيرات القالب بالترتيب</span>
        <p className="form-hint">
          طابق قالبك: <span dir="ltr">{"{{1}}"}</span> هو المتغير الأول،{" "}
          <span dir="ltr">{"{{2}}"}</span> الثاني… اتركها فارغة إذا كان القالب
          بلا متغيرات.
        </p>
        {params.fields.map((field, index) => {
          const source = sources[index]?.source;
          const rowError = errors.params?.[index]?.value?.message;
          return (
            <div key={field.id} className="campaign-var-row">
              <span className="wa-param-slot">{`{{${index + 1}}}`}</span>
              <Select
                aria-label={`نوع المتغير {{${index + 1}}}`}
                options={VARIABLE_SOURCES}
                {...register(`params.${index}.source`)}
              />
              {source === "coupon_code" && (
                <Select
                  aria-label={`كوبون المتغير {{${index + 1}}}`}
                  placeholder={
                    coupons.length ? "اختر كوبونًا" : "لا توجد كوبونات نشطة"
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
                      aria-label={`نص المتغير {{${index + 1}}}`}
                      placeholder="مثال: خصم 20% على كل المنتجات"
                      maxLength={1000}
                      invalid={Boolean(rowError)}
                      {...input}
                    />
                  )}
                />
              )}
              {source === "customer_name" && (
                <span className="campaign-var-note">
                  يُعبّأ تلقائيًا لكل عميل
                </span>
              )}
              <IconButton
                icon={X}
                label={`حذف المتغير {{${index + 1}}}`}
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
          إضافة متغير
        </Button>
      </div>
    </fieldset>
  );
}
