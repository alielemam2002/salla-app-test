import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearCouponBar,
  fetchCouponBar,
  saveCouponBar,
} from "../../utils/couponBarApi.js";
import { CouponApiError } from "./useCoupons.js";

export const couponBarKeys = { all: ["coupon-bar"] };

const unwrap = (result) => {
  if (!result?.success) throw new CouponApiError(result);
  return result.bar ?? null;
};

const noTokenResult = {
  success: false,
  status: 401,
  code: "session_invalid",
  error: "No embedded token found",
};

/** The storefront announcement bar (null when none is shown). */
export function useCouponBarQuery(getToken) {
  return useQuery({
    queryKey: couponBarKeys.all,
    queryFn: async () => {
      const token = getToken();
      if (!token) throw new CouponApiError(noTokenResult);
      return unwrap(await fetchCouponBar(token));
    },
    retry: false,
  });
}

/**
 * `save.mutate(bar)` shows a bar, `clear.mutate(code)` hides it if it's
 * `code`'s. Both write the new bar straight into the query cache.
 */
export function useCouponBarMutations(getToken) {
  const queryClient = useQueryClient();
  const store = (bar) => queryClient.setQueryData(couponBarKeys.all, bar);

  const withToken = (fn) => async (vars) => {
    const token = getToken();
    if (!token) throw new CouponApiError(noTokenResult);
    return unwrap(await fn(token, vars));
  };

  const save = useMutation({
    mutationFn: withToken((token, bar) => saveCouponBar(token, bar)),
    onSuccess: store,
  });
  const clear = useMutation({
    mutationFn: withToken((token, code) => clearCouponBar(token, code)),
    onSuccess: store,
  });

  return { save, clear };
}
