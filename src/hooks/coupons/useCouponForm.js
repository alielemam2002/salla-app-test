import { useCallback, useEffect, useState } from "react";
import {
  couponToForm,
  formToCouponInput,
  formToDisplaySettings,
  validateCouponForm,
} from "../../utils/coupons/couponForm.js";

/**
 * Form state for the create/edit dialog. Resets whenever the dialog opens
 * for a different coupon. `submit` validates first and only calls
 * `onValid(input, displaySettings)` when the client-side checks pass.
 */
export function useCouponForm({ coupon, isOpen }) {
  const [form, setForm] = useState(() => couponToForm(coupon));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setForm(couponToForm(coupon));
      setErrors({});
    }
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
      const found = validateCouponForm(form);
      setErrors(found);
      if (Object.keys(found).length) return false;
      onValid(formToCouponInput(form), formToDisplaySettings(form));
      return true;
    },
    [form],
  );

  return { form, errors, setField, submit };
}
