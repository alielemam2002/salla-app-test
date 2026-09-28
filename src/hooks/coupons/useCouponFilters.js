import { useMemo, useState } from "react";
import { useStatusClock } from "./useCouponClock.js";
import {
  getCouponStatus,
  matchesSearch,
} from "../../utils/coupons/couponModel.js";

export const COUPON_FILTERS = [
  "all",
  "active",
  "scheduled",
  "expired",
  "disabled",
];

/**
 * Status filter + code search over the loaded coupons. Statuses are
 * recomputed only when the status clock moves (a coupon starts or ends),
 * not on every countdown tick.
 */
export function useCouponFilters(coupons) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const now = useStatusClock(coupons);

  const withStatus = useMemo(
    () =>
      coupons.map((coupon) => ({
        coupon,
        status: getCouponStatus(coupon, now),
      })),
    [coupons, now],
  );

  const counts = useMemo(() => {
    const result = { all: withStatus.length };
    for (const key of COUPON_FILTERS.slice(1)) result[key] = 0;
    for (const { status } of withStatus) result[status] += 1;
    return result;
  }, [withStatus]);

  const visible = useMemo(
    () =>
      withStatus.filter(
        (item) =>
          (filter === "all" || item.status === filter) &&
          matchesSearch(item.coupon, query),
      ),
    [withStatus, filter, query],
  );

  const statusById = useMemo(
    () => new Map(withStatus.map(({ coupon, status }) => [coupon.id, status])),
    [withStatus],
  );

  return {
    filter,
    setFilter,
    query,
    setQuery,
    counts,
    visible,
    statusById,
    isFiltered: filter !== "all" || query.trim() !== "",
    clear: () => {
      setFilter("all");
      setQuery("");
    },
  };
}
