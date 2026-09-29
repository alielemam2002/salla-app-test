import { useCallback, useEffect, useState } from "react";
import {
  couponToForm,
  formToCouponInput,
  validateCouponForm,
} from "../../utils/coupons/couponForm.js";
import {
  barToForm,
  formToBarInput,
  validateBarForm,
} from "../../utils/coupons/couponBar.js";

const initialForm = (coupon, bar) => ({
  ...couponToForm(coupon),
  ...barToForm(bar, coupon),
});

/**
 * Form state for the create/edit dialog, including the storefront bar
 * fields. Resets whenever the dialog opens for a different coupon. `submit`
 * validates first and only calls `onValid(input, bar)` when the client-side
 * checks pass (`bar` is null when the bar option is off).
 */
export function useCouponForm({ coupon, bar, isOpen, currency }) {
  const [form, setForm] = useState(() => initialForm(coupon, bar));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setForm(initialForm(coupon, bar));
      setErrors({});
    }
    // `bar` is left out on purpose: a background refetch must not wipe
    // what the merchant is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupon, isOpen]);

  const setField = useCallback((name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const submit = useCallback(
    (onValid) => {
      const found = { ...validateCouponForm(form), ...validateBarForm(form) };
      setErrors(found);
      if (Object.keys(found).length) return false;
      const input = formToCouponInput(form);
      onValid(input, formToBarInput(form, input, currency));
      return true;
    },
    [form, currency],
  );

  return { form, errors, setField, submit };
}
