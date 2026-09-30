import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearStockAlerts,
  fetchAlertsOverview,
  fetchStockLevels,
  markAlertsRead,
  saveAlertThreshold,
} from "../../utils/alertsApi.js";

/** Error carrying the API result so the UI can describe it. */
export class AlertsApiError extends Error {
  constructor(result) {
    super(result?.error || "تعذّر تحميل التنبيهات");
    this.name = "AlertsApiError";
    this.result = result;
  }
}

export const alertKeys = {
  all: ["stock-alerts"],
  overview: ["stock-alerts", "overview"],
  stock: ["stock-alerts", "stock"],
};

const noToken = {
  success: false,
  status: 401,
  code: "session_invalid",
  error: "لم يتم العثور على رمز الجلسة. افتح التطبيق من لوحة تحكم سلة.",
};

const withToken = (getToken, fn) => async (vars) => {
  const token = getToken();
  if (!token) throw new AlertsApiError(noToken);
  const result = await fn(token, vars);
  if (!result.success) throw new AlertsApiError(result);
  return result;
};

/**
 * Order alerts written by the webhook. Checked again every minute while
 * the tab is open, so a new order's alert shows up without a refresh.
 */
export function useAlertsOverview(getToken) {
  return useQuery({
    queryKey: alertKeys.overview,
    queryFn: withToken(getToken, fetchAlertsOverview),
    retry: false,
    refetchInterval: 60 * 1000,
  });
}

/** Products out of stock / running low right now (scans the product list). */
export function useStockLevels(getToken) {
  return useQuery({
    queryKey: alertKeys.stock,
    queryFn: withToken(getToken, fetchStockLevels),
    retry: false,
    staleTime: 2 * 60 * 1000,
  });
}

/** Change the threshold, mark alerts read, or clear them. */
export function useAlertsMutations(getToken) {
  const queryClient = useQueryClient();
  const refresh = (key) => () =>
    queryClient.invalidateQueries({ queryKey: key });
  const saveThreshold = useMutation({
    mutationFn: withToken(getToken, saveAlertThreshold),
    onSuccess: refresh(alertKeys.all),
  });
  const markRead = useMutation({
    mutationFn: withToken(getToken, markAlertsRead),
    onSuccess: refresh(alertKeys.overview),
  });
  const clear = useMutation({
    mutationFn: withToken(getToken, clearStockAlerts),
    onSuccess: refresh(alertKeys.overview),
  });
  return { saveThreshold, markRead, clear };
}
