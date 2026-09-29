import { Megaphone } from "lucide-react";
import { Alert, Field, FormRow, Switch, TextInput } from "../ui/index.js";
import { BAR_TEXT_MAX, defaultBarText } from "../../utils/coupons/couponBar.js";

/**
 * "Storefront announcement bar" section of the coupon form: the on/off
 * switch, text, colors and a live preview of the strip shoppers will see.
 * `liveBar` is the bar currently on the storefront (any coupon);
 * `unavailable` is a reason the bar can't be managed right now.
 */
export default function CouponBarFields({
  form,
  errors,
  setField,
  currency,
  liveBar,
  originalCode,
  unavailable,
}) {
  const suggested = defaultBarText(form, currency);
  const text = form.bar_text.trim() || suggested;
  const replacing =
    form.bar_enabled && liveBar && liveBar.code !== originalCode
      ? liveBar.code
      : null;

  return (
    <section
      className="coupon-bar-fields"
      aria-label="Storefront announcement bar"
    >
      <Switch
        label={
          <span className="coupon-bar-fields-label">
            <Megaphone size={15} aria-hidden="true" />
            Storefront announcement bar
          </span>
        }
        description="Show a strip at the top of every store page that advertises this code. It hides itself when the coupon ends."
        checked={form.bar_enabled}
        disabled={Boolean(unavailable)}
        onChange={(v) => setField("bar_enabled", v)}
      />

      {unavailable && (
        <Alert tone="warning" title="The announcement bar isn't available.">
          {unavailable}
        </Alert>
      )}

      {form.bar_enabled && !unavailable && (
        <>
          {replacing && (
            <Alert tone="info">
              The store shows one bar at a time. Saving replaces the bar for{" "}
              <strong>{replacing}</strong>.
            </Alert>
          )}

          <Field
            label="Bar text"
            hint="Leave empty to use the suggested text."
            error={errors.bar_text}
          >
            <TextInput
              value={form.bar_text}
              onChange={(e) => setField("bar_text", e.target.value)}
              invalid={Boolean(errors.bar_text)}
              placeholder={suggested}
              maxLength={BAR_TEXT_MAX}
              dir="auto"
            />
          </Field>

          <FormRow>
            <Field label="Background">
              <TextInput
                type="color"
                className="coupon-bar-color"
                value={form.bar_bg_color}
                onChange={(e) => setField("bar_bg_color", e.target.value)}
              />
            </Field>
            <Field label="Text color">
              <TextInput
                type="color"
                className="coupon-bar-color"
                value={form.bar_text_color}
                onChange={(e) => setField("bar_text_color", e.target.value)}
              />
            </Field>
          </FormRow>

          <div className="coupon-bar-preview-wrap">
            <span className="form-label">Preview</span>
            <div
              className="coupon-bar-preview"
              dir="rtl"
              style={{
                backgroundColor: form.bar_bg_color,
                color: form.bar_text_color,
              }}
            >
              <span>{text}</span>
              {form.code.trim() && (
                <span
                  className="coupon-bar-preview-code"
                  style={{ borderColor: form.bar_text_color }}
                >
                  {form.code.trim()}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
