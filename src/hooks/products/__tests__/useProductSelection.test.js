import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useProductSelection } from "../useProductSelection.js";

const products = [{ id: 1 }, { id: 2 }, { id: 3 }];

describe("useProductSelection", () => {
  it("counts every matching product minus the unticked ones", () => {
    const { result } = renderHook(() =>
      useProductSelection(products, { total: 124, scopeKey: "|sale|" }),
    );
    act(() => result.current.toggleAll());
    act(() => result.current.selectAllMatching());
    expect(result.current.count).toBe(124);

    act(() => result.current.toggle(2));
    expect(result.current.count).toBe(123);
    expect(result.current.excludedIds).toEqual([2]);
    expect(result.current.isSelected(2)).toBe(false);
    expect(result.current.selectedProducts.map((p) => p.id)).toEqual([1, 3]);
  });

  it("drops 'all matching' when the list filters change, keeps plain ids", () => {
    const { result, rerender } = renderHook(
      ({ scopeKey }) => useProductSelection(products, { total: 124, scopeKey }),
      { initialProps: { scopeKey: "|sale|" } },
    );
    act(() => result.current.selectAllMatching());
    rerender({ scopeKey: "|out|" });
    expect(result.current.allMatching).toBe(false);
    expect(result.current.count).toBe(0);

    act(() => result.current.toggle(1));
    rerender({ scopeKey: "|hidden|" });
    expect(result.current.selectedIds).toEqual([1]);
  });
});
