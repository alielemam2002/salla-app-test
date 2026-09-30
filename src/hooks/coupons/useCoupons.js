import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCoupon,
  deleteCoupon,
  fetchAllCoupons,
  updateCoupon,
} from "../../utils/couponsApi.js";

export const couponKeys = {
  all: ["coupons"],
  list: () => ["coupons", "list"],
};

/** Error carrying the API result so the UI can describe it precisely. */
export class CouponApiError extends Error {
  constructor(result) {
    super(result?.error || "فشل طلب الكوبون");
    this.name = "CouponApiError";
    this.result = result;
  }
}

const unwrap = (result) => {
  if (!result?.success) throw new CouponApiError(result);
  return result;
};

const noTokenResult = {
  success: false,
  status: 401,
  code: "session_invalid",
  error: "لم يتم العثور على رمز الجلسة",
};

/** Every coupon in the store (all pages, fetched sequentially). */
export function useCouponsQuery(getToken) {
  return useQuery({
    queryKey: couponKeys.list(),
    queryFn: async () => {
      const token = getToken();
      if (!token) throw new CouponApiError(noTokenResult);
      return unwrap(await fetchAllCoupons(token)).coupons;
    },
    // Don't hammer Salla on auth/validation errors; one retry for transient ones.
    retry: (count, error) =>
      count < 1 && !(error?.result?.status >= 400 && error.result.status < 500),
  });
}

/**
 * Create / update / delete. Each success invalidates the coupons list so the
 * UI shows what Salla actually stored.
 */
export function useCouponMutations(getToken) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: couponKeys.all });

  const withToken = (fn) => async (vars) => {
    const token = getToken();
    if (!token) throw new CouponApiError(noTokenResult);
    return unwrap(await fn(token, vars));
  };

  const create = useMutation({
    mutationFn: withToken((token, input) => createCoupon(token, input)),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: withToken((token, { id, input }) =>
      updateCoupon(token, id, input),
    ),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: withToken((token, id) => deleteCoupon(token, id)),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
