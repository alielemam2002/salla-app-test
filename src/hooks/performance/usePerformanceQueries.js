import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  runPerformanceTest,
  fetchStoreDefaultUrl,
} from "../../utils/performance/performanceApi.js";
import { getScanHistory } from "../../utils/performance/historyStorage.js";

export const performanceKeys = {
  all: ["performance"],
  report: (url) => ["performance", "report", url ? url.replace(/\/$/, "") : ""],
  storeUrl: (token, appId) => ["performance", "storeUrl", token, appId],
  history: (url, strategy, days) => [
    "performance",
    "history",
    url ? url.replace(/\/$/, "") : "",
    strategy,
    days,
  ],
};

/**
 * Hook to retrieve merchant's default store URL from Salla
 */
export function useStoreDefaultUrl(token, appId) {
  return useQuery({
    queryKey: performanceKeys.storeUrl(token, appId),
    queryFn: () => fetchStoreDefaultUrl(token, appId),
    enabled: Boolean(token && appId),
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24,
  });
}

/**
 * Hook to run a live performance scan on mobile & desktop with progressive strategy support
 */
export function useRunPerformanceTest({ storeId = "default" } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      url,
      strategy = "all",
      apiKey = "",
      force = false,
      existingReport = null,
      onProgressStep,
    }) => {
      if (typeof onProgressStep === "function") {
        onProgressStep("preparing");
      }

      await new Promise((r) => setTimeout(r, 60));

      if (typeof onProgressStep === "function") {
        onProgressStep("fetching");
      }

      const report = await runPerformanceTest(url, {
        strategy,
        apiKey,
        force,
        existingReport,
        storeId,
      });

      if (typeof onProgressStep === "function") {
        onProgressStep("completed");
      }

      return report;
    },
    onSuccess: (report) => {
      if (report?.url) {
        queryClient.setQueryData(performanceKeys.report(report.url), report);
        queryClient.invalidateQueries({ queryKey: ["performance", "history"] });
      }
    },
  });
}

/**
 * Hook to retrieve scan history for charts & trends
 */
export function usePerformanceHistory({
  url,
  strategy = "mobile",
  days = 30,
} = {}) {
  return useQuery({
    queryKey: performanceKeys.history(url, strategy, days),
    queryFn: () => getScanHistory({ url, strategy, days }),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
