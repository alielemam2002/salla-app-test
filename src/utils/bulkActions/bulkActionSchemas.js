import { z } from "zod";
import {
  APPLY_ON,
  PRICING_COLUMNS,
  SALE_CHANNELS,
  findFormula,
} from "./bulkActionSpec.js";

// A blank input must fail instead of coercing to 0.
const blankToUndefined = (v) => (v === "" || v === null ? undefined : v);

const wholeNumber = (label, max) => {
  let schema = z.coerce
    .number({ error: `${label} مطلوب` })
    .int(`${label} يجب أن يكون عددًا صحيحًا`)
    .min(0, `${label} لا يمكن أن يكون سالبًا`);
  if (max !== undefined) schema = schema.max(max, `${label} لا يزيد عن ${max}`);
  return z.preprocess(blankToUndefined, schema);
};

/** Zod schema per UI action (keys match BULK_UI_ACTIONS). */
export const BULK_ACTION_SCHEMAS = {
  pricing: z
    .object({
      column: z.enum(PRICING_COLUMNS),
      formulaId: z.string(),
      amount: z.coerce
        .number({ error: "أدخل القيمة" })
        .positive("يجب أن تكون القيمة أكبر من 0"),
      apply_on: z.enum(APPLY_ON),
    })
    .superRefine((value, ctx) => {
      const formula = findFormula(value.column, value.formulaId);
      if (!formula) {
        ctx.addIssue({
          code: "custom",
          path: ["formulaId"],
          message: "اختر طريقة تغيير السعر",
        });
        return;
      }
      if (
        formula.unit === "percent" &&
        formula.id.includes("minus") &&
        value.amount >= 100
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["amount"],
          message: "يجب أن تكون نسبة الخفض أقل من 100%",
        });
      }
    }),
  categories: z.object({
    categories: z.array(z.string()).min(1, "اختر تصنيفًا واحدًا على الأقل"),
  }),
  brand: z.object({
    brand_id: z.string().min(1, "اختر علامة تجارية"),
  }),
  tags: z.object({
    tags: z.array(z.string()).min(1, "اختر وسمًا واحدًا على الأقل"),
  }),
  channels: z.object({
    channels: z
      .array(z.enum(SALE_CHANNELS))
      .min(1, "اختر قناة بيع واحدة على الأقل"),
  }),
  notify: z.object({
    notify_quantity: wholeNumber("كمية التنبيه"),
    minimum_notify_quantity: wholeNumber("الحد الأدنى لكمية التنبيه"),
    subscribers_percentage: wholeNumber("نسبة المشتركين", 100),
  }),
  duplicate: z.object({}),
};
