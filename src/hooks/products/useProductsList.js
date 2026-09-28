import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAllProducts,
  fetchProductsPage,
} from "../../utils/productsApi.js";
import { PRODUCTS_PER_PAGE } from "../../utils/productConstants.js";
import logger from "../../utils/logger.js";

/**
 * Paged product list with keyword search, status filter and "fetch all".
 * Stale responses are dropped via a request counter.
 */
export function useProductsList({ getToken, showToast }) {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [showingAll, setShowingAll] = useState(false);

  const [keywordInput, setKeywordInput] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const requestIdRef = useRef(0);

  const handleFailure = useCallback((result) => {
    logger.error("Products operation failed:", result);
    setError({ code: result.code, message: result.error });
  }, []);

  const loadPage = useCallback(
    async (
      targetPage,
      searchKeyword = appliedKeyword,
      filterStatus = statusFilter,
    ) => {
      const token = getToken();
      if (!token) {
        setError({
          code: "no_token",
          message:
            "No embedded token found. Open this app from the Salla dashboard.",
        });
        setIsLoading(false);
        return;
      }

      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);
      setProgress(null);

      const result = await fetchProductsPage(token, {
        page: targetPage,
        perPage: PRODUCTS_PER_PAGE,
        keyword: searchKeyword || undefined,
        status: filterStatus || undefined,
      });

      if (requestId !== requestIdRef.current) return; // stale response

      if (result.success) {
        setProducts(result.products || []);
        setPagination(result.pagination);
        setPage(targetPage);
        setShowingAll(false);
      } else {
        handleFailure(result);
      }
      setIsLoading(false);
    },
    [getToken, appliedKeyword, statusFilter, handleFailure],
  );

  const loadAll = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    setProgress({ page: 0, totalPages: pagination?.totalPages || "?" });

    const result = await fetchAllProducts(token, {
      perPage: PRODUCTS_PER_PAGE,
      keyword: appliedKeyword || undefined,
      status: statusFilter || undefined,
      onProgress: (p) => {
        if (requestId === requestIdRef.current) setProgress(p);
      },
    });
    if (requestId !== requestIdRef.current) return;

    if (result.success) {
      setProducts(result.products);
      setPagination(result.pagination);
      setShowingAll(true);
      showToast?.(`Loaded all ${result.products.length} products`, "success");
    } else {
      handleFailure(result);
    }
    setProgress(null);
    setIsLoading(false);
  }, [
    getToken,
    pagination,
    appliedKeyword,
    statusFilter,
    showToast,
    handleFailure,
  ]);

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  const submitSearch = useCallback(() => {
    const trimmed = keywordInput.trim();
    setAppliedKeyword(trimmed);
    loadPage(1, trimmed, statusFilter);
  }, [keywordInput, loadPage, statusFilter]);

  const clearSearch = useCallback(() => {
    setKeywordInput("");
    setAppliedKeyword("");
    loadPage(1, "", statusFilter);
  }, [loadPage, statusFilter]);

  const changeStatusFilter = useCallback(
    (newStatus) => {
      setStatusFilter(newStatus);
      loadPage(1, appliedKeyword, newStatus);
    },
    [loadPage, appliedKeyword],
  );

  const refresh = useCallback(
    () => loadPage(showingAll ? 1 : page),
    [loadPage, showingAll, page],
  );

  return {
    products,
    setProducts,
    pagination,
    setPagination,
    page,
    totalPages: pagination?.totalPages || 1,
    total: pagination?.total ?? products.length,
    isLoading,
    progress,
    error,
    showingAll,
    loadPage,
    loadAll,
    refresh,
    search: {
      keywordInput,
      setKeywordInput,
      appliedKeyword,
      statusFilter,
      hasFilters: Boolean(appliedKeyword || statusFilter),
      submitSearch,
      clearSearch,
      changeStatusFilter,
    },
  };
}
