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
    .number({ error: `${label} is required` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} can't be negative`);
  if (max !== undefined) schema = schema.max(max, `${label} is at most ${max}`);
  return z.preprocess(blankToUndefined, schema);
};

/** Zod schema per UI action (keys match BULK_UI_ACTIONS). */
export const BULK_ACTION_SCHEMAS = {
  pricing: z
    .object({
      column: z.enum(PRICING_COLUMNS),
      formulaId: z.string(),
      amount: z.coerce
        .number({ error: "Enter an amount" })
        .positive("Amount must be greater than 0"),
      apply_on: z.enum(APPLY_ON),
    })
    .superRefine((value, ctx) => {
      const formula = findFormula(value.column, value.formulaId);
      if (!formula) {
        ctx.addIssue({
          code: "custom",
          path: ["formulaId"],
          message: "Choose how to change the price",
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
          message: "A percentage decrease must be below 100%",
        });
      }
    }),
  categories: z.object({
    categories: z.array(z.string()).min(1, "Choose at least one category"),
  }),
  brand: z.object({
    brand_id: z.string().min(1, "Choose a brand"),
  }),
  tags: z.object({
    tags: z.array(z.string()).min(1, "Choose at least one tag"),
  }),
  channels: z.object({
    channels: z
      .array(z.enum(SALE_CHANNELS))
      .min(1, "Choose at least one channel"),
  }),
  notify: z.object({
    notify_quantity: wholeNumber("Notify quantity"),
    minimum_notify_quantity: wholeNumber("Minimum notify quantity"),
    subscribers_percentage: wholeNumber("Subscribers percentage", 100),
  }),
  duplicate: z.object({}),
};
