import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelReplenishReminder,
  fetchReplenish,
  saveReplenishSettings,
  sendReminderNow,
  sendReplenishTest,
  setProductCycle,
} from "../../utils/replenishApi.js";
import { fetchProductsPage } from "../../utils/productsApi.js";

/** Error carrying the API result so the UI can describe it. */
export class ReplenishApiError extends Error {
  constructor(result) {
    super(result?.error || "تعذّر تنفيذ العملية");
    this.name = "ReplenishApiError";
    this.result = result;
  }
}

export const replenishKeys = {
  all: ["replenish"],
  overview: ["replenish", "overview"],
  products: (keyword) => ["replenish", "products", keyword],
};

const noToken = {
  success: false,
  status: 401,
  code: "session_invalid",
  error: "لم يتم العثور على رمز الجلسة. افتح التطبيق من لوحة تحكم سلة.",
};

const withToken = (getToken, fn) => async (vars) => {
  const token = getToken();
  if (!token) throw new ReplenishApiError(noToken);
  const result = await fn(token, vars);
  if (!result.success) throw new ReplenishApiError(result);
  return result;
};

/** Settings, cycles, reminders and what's missing. */
export function useReplenish(getToken) {
  return useQuery({
    queryKey: replenishKeys.overview,
    queryFn: withToken(getToken, fetchReplenish),
    retry: false,
  });
}

/** One page of the store's products (search) to set cycles on. */
export function useReplenishProducts(getToken, keyword) {
  return useQuery({
    queryKey: replenishKeys.products(keyword),
    queryFn: withToken(getToken, (token) =>
      fetchProductsPage(token, { keyword, perPage: 30 }),
    ),
    retry: false,
    placeholderData: (previous) => previous,
  });
}

/** Save settings / a cycle, send or cancel a reminder, send a test. */
export function useReplenishMutations(getToken) {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: replenishKeys.overview });

  const saveSettings = useMutation({
    mutationFn: withToken(getToken, saveReplenishSettings),
    onSuccess: refresh,
  });
  const setCycle = useMutation({
    mutationFn: withToken(getToken, setProductCycle),
    onSuccess: refresh,
  });
  const sendNow = useMutation({
    mutationFn: withToken(getToken, sendReminderNow),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: withToken(getToken, cancelReplenishReminder),
    onSuccess: refresh,
  });
  const sendTest = useMutation({
    mutationFn: withToken(getToken, sendReplenishTest),
  });
  return { saveSettings, setCycle, sendNow, cancel, sendTest };
}
