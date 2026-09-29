import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Product selection with two modes, matching Salla's bulk `filters`:
 * - ids: checkboxes over loaded products (`selectedIds`)
 * - all matching: every product that matches the list filters, minus the
 *   ones unticked (`excludedIds` → `unselected_ids`), so no id list is
 *   loaded or sent. `total` is the matching count from the list.
 * "All matching" is dropped when `scopeKey` (the list filters) changes.
 */
export function useProductSelection(
  products,
  { total = 0, scopeKey = "" } = {},
) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [allMatching, setAllMatching] = useState(false);
  const [excludedIds, setExcludedIds] = useState([]);

  // "All matching" means "all matching these filters": new filters, new
  // selection. Plain id selections are kept, as before.
  const lastScope = useRef(scopeKey);
  useEffect(() => {
    if (lastScope.current === scopeKey) return;
    lastScope.current = scopeKey;
    if (allMatching) {
      setAllMatching(false);
      setExcludedIds([]);
      setSelectedIds([]);
    }
  }, [scopeKey, allMatching]);

  const isSelected = useCallback(
    (id) =>
      allMatching ? !excludedIds.includes(id) : selectedIds.includes(id),
    [allMatching, excludedIds, selectedIds],
  );

  const toggle = useCallback(
    (id) => {
      const flip = (prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      if (allMatching) setExcludedIds(flip);
      else setSelectedIds(flip);
    },
    [allMatching],
  );

  const isAllSelected =
    products.length > 0 && products.every((p) => isSelected(p.id));
  const isSomeSelected =
    products.some((p) => isSelected(p.id)) && !isAllSelected;

  const toggleAll = useCallback(() => {
    const pageIds = products.map((p) => p.id);
    if (allMatching) {
      setExcludedIds((prev) => {
        const noneExcluded = pageIds.every((id) => !prev.includes(id));
        return noneExcluded
          ? Array.from(new Set([...prev, ...pageIds]))
          : prev.filter((id) => !pageIds.includes(id));
      });
      return;
    }
    setSelectedIds((prev) => {
      const allSelected =
        pageIds.length > 0 && pageIds.every((id) => prev.includes(id));
      return allSelected
        ? prev.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...prev, ...pageIds]));
    });
  }, [products, allMatching]);

  const selectAllMatching = useCallback(() => {
    setAllMatching(true);
    setExcludedIds([]);
  }, []);

  const clear = useCallback(() => {
    setSelectedIds([]);
    setAllMatching(false);
    setExcludedIds([]);
  }, []);

  const remove = useCallback(
    (id) => setSelectedIds((prev) => prev.filter((item) => item !== id)),
    [],
  );

  const selectedProducts = useMemo(
    () => products.filter((p) => isSelected(p.id)),
    [products, isSelected],
  );

  const count = allMatching
    ? Math.max(0, total - excludedIds.length)
    : selectedIds.length;

  return {
    selectedIds,
    selectedProducts,
    count,
    allMatching,
    excludedIds,
    isSelected,
    isAllSelected,
    isSomeSelected,
    toggle,
    toggleAll,
    selectAllMatching,
    clear,
    remove,
  };
}
