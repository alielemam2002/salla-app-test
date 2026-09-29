import { useId } from "react";
import { Ticket } from "lucide-react";
import {
  Alert,
  Button,
  Field,
  FormRow,
  Modal,
  Select,
  Switch,
  TextInput,
} from "../ui/index.js";
import { useCouponForm } from "../../hooks/coupons/useCouponForm.js";
import { FIELD_LABELS } from "../../utils/coupons/couponErrors.js";
import CouponScope from "./CouponScope.jsx";

const TYPE_OPTIONS = [
  { value: "percentage", label: "Percentage (%)" },
  { value: "fixed", label: "Fixed amount" },
];

/**
 * Create / edit a storewide coupon.
 * `serverError` is the described Salla error ({ title, reason, fieldErrors }).
 */
export default function CouponFormModal({
  isOpen,
  coupon,
  currency = "SAR",
  saving,
  serverError,
  onClose,
  onSubmit,
}) {
  const formId = useId();
  const isEdit = Boolean(coupon);
  const { form, errors, setField, submit } = useCouponForm({ coupon, isOpen });

  const fieldError = (name) => errors[name] || serverError?.fieldErrors?.[name];
  // Salla field errors for inputs this form doesn't show still need a place.
  const otherServerFields = Object.entries(
    serverError?.fieldErrors || {},
  ).filter(([name]) => !(name in form));

  const text = (name, props = {}) => (
    <TextInput
      value={form[name]}
      onChange={(e) => setField(name, e.target.value)}
      invalid={Boolean(fieldError(name))}
      {...props}
    />
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    submit(onSubmit);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dismissible={!saving}
      icon={Ticket}
      title={isEdit ? `Edit coupon ${coupon.code}` : "Create Coupon"}
      subtitle="Storewide discount code"
      size="lg"
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            loading={saving}
          >
            {isEdit ? "Save changes" : "Create Coupon"}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="coupon-form"
        onSubmit={handleSubmit}
        noValidate
      >
        {serverError && (
          <Alert tone="error" title={serverError.title}>
            <p>Salla rejected the request: {serverError.reason}</p>
            {otherServerFields.length > 0 && (
              <ul className="coupon-form-server-fields">
                {otherServerFields.map(([name, message]) => (
                  <li key={name}>
                    {FIELD_LABELS[name] || name}: {message}
                  </li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        <CouponScope storewide detailed />

        <Field
          label="Coupon Code"
          required
          hint="Customers enter this code at checkout."
          error={fieldError("code")}
        >
          {text("code", {
            autoComplete: "off",
            spellCheck: false,
            placeholder: "SUMMER20",
            className: "coupon-code-input",
          })}
        </Field>

        <FormRow>
          <Field label="Discount type" required error={fieldError("type")}>
            <Select
              value={form.type}
              onChange={(e) => setField("type", e.target.value)}
              options={TYPE_OPTIONS}
            />
          </Field>
          <Field label="Discount" required error={fieldError("amount")}>
            {text("amount", {
              type: "number",
              inputMode: "decimal",
              min: 0,
              step: "any",
              suffix: form.type === "percentage" ? "%" : currency,
            })}
          </Field>
        </FormRow>

        <FormRow>
          {form.type === "percentage" && (
            <Field
              label="Maximum discount"
              required
              hint="Caps the discount per order."
              error={fieldError("maximum_amount")}
            >
              {text("maximum_amount", {
                type: "number",
                inputMode: "decimal",
                min: 0,
                step: "any",
                suffix: currency,
              })}
            </Field>
          )}
          <Field
            label="Minimum order"
            hint="Optional. Cart total needed to use the coupon."
            error={fieldError("minimum_amount")}
          >
            {text("minimum_amount", {
              type: "number",
              inputMode: "decimal",
              min: 0,
              step: "any",
              suffix: currency,
            })}
          </Field>
        </FormRow>

        <FormRow>
          <Field
            label="Start date"
            hint="Optional. Leave empty to start right away. Store time (Riyadh)."
            error={fieldError("start_date")}
          >
            {text("start_date", { type: "datetime-local" })}
          </Field>
          <Field
            label="End date"
            required
            hint="At least one day after today. Store time (Riyadh)."
            error={fieldError("expiry_date")}
          >
            {text("expiry_date", { type: "datetime-local" })}
          </Field>
        </FormRow>

        <FormRow>
          <Field
            label="Usage limit"
            hint="Optional. Total times the coupon can be used."
            error={fieldError("usage_limit")}
          >
            {text("usage_limit", {
              type: "number",
              inputMode: "numeric",
              min: 1,
              step: 1,
            })}
          </Field>
          <Field
            label="Limit per customer"
            hint="Optional."
            error={fieldError("usage_limit_per_user")}
          >
            {text("usage_limit_per_user", {
              type: "number",
              inputMode: "numeric",
              min: 1,
              step: 1,
            })}
          </Field>
        </FormRow>

        <div className="coupon-form-switches">
          <Switch
            label="Free shipping"
            description="Orders using this coupon also ship free."
            checked={form.free_shipping}
            onChange={(v) => setField("free_shipping", v)}
          />
          <Switch
            label="Exclude sale products"
            description="Products already on sale don't get the extra discount."
            checked={form.exclude_sale_products}
            onChange={(v) => setField("exclude_sale_products", v)}
          />
          <Switch
            label="Enabled"
            description="Turn off to disable the coupon without deleting it."
            checked={form.active}
            onChange={(v) => setField("active", v)}
          />
        </div>
      </form>
    </Modal>
  );
}
