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
  return result;
};

const noTokenResult = {
  success: false,
  status: 401,
  code: "session_invalid",
  error: "No embedded token found",
};

/**
 * The storefront announcement bar: `{ bar, storeId, merchantId }`.
 * `bar` is null when none is shown. `storeId` is the store the bar is saved
 * in (the access token's store), `merchantId` the signed-in store.
 */
export function useCouponBarQuery(getToken) {
  return useQuery({
    queryKey: couponBarKeys.all,
    queryFn: async () => {
      const token = getToken();
      if (!token) throw new CouponApiError(noTokenResult);
      const result = unwrap(await fetchCouponBar(token));
      return {
        bar: result.bar ?? null,
        storeId: result.storeId ?? null,
        merchantId: result.merchantId ?? null,
      };
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
  const store = (result) =>
    queryClient.setQueryData(couponBarKeys.all, (prev) => ({
      storeId: null,
      merchantId: null,
      ...prev,
      bar: result.bar ?? null,
    }));

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
