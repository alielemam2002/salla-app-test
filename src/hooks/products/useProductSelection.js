import { useCallback, useMemo, useState } from "react";

/** Checkbox selection over the currently visible products. */
export function useProductSelection(products) {
  const [selectedIds, setSelectedIds] = useState([]);

  const toggle = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const isAllSelected =
    products.length > 0 && products.every((p) => selectedIds.includes(p.id));
  const isSomeSelected =
    products.some((p) => selectedIds.includes(p.id)) && !isAllSelected;

  const toggleAll = useCallback(() => {
    const pageIds = products.map((p) => p.id);
    setSelectedIds((prev) => {
      const allSelected =
        pageIds.length > 0 && pageIds.every((id) => prev.includes(id));
      return allSelected
        ? prev.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...prev, ...pageIds]));
    });
  }, [products]);

  const clear = useCallback(() => setSelectedIds([]), []);

  const remove = useCallback(
    (id) => setSelectedIds((prev) => prev.filter((item) => item !== id)),
    [],
  );

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedIds.includes(p.id)),
    [products, selectedIds],
  );

  return {
    selectedIds,
    selectedProducts,
    count: selectedIds.length,
    isSelected: (id) => selectedIds.includes(id),
    isAllSelected,
    isSomeSelected,
    toggle,
    toggleAll,
    clear,
    remove,
  };
}
