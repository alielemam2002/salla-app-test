import { QueryCache, MutationCache, QueryClient } from "@tanstack/react-query";
import { embedded } from "@salla.sa/embedded-sdk";
import { isSessionInvalidError, refreshSallaSession } from "./sallaSession.js";

const handleSessionError = (error) => {
  if (isSessionInvalidError(error)) {
    refreshSallaSession(embedded);
  }
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleSessionError,
  }),
  mutationCache: new MutationCache({
    onError: handleSessionError,
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (isSessionInvalidError(error)) return false;
        return failureCount < 1;
      },
    },
    mutations: {
      retry: 0,
    },
  },
});
