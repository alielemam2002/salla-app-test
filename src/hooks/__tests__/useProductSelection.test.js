import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useProductSelection } from "../products/useProductSelection.js";

const products = [{ id: 1 }, { id: 2 }];

describe("useProductSelection", () => {
  it("toggles single rows and derives partial state", () => {
    const { result } = renderHook(() => useProductSelection(products));
    act(() => result.current.toggle(1));
    expect(result.current.selectedIds).toEqual([1]);
    expect(result.current.isSomeSelected).toBe(true);
    expect(result.current.selectedProducts).toEqual([{ id: 1 }]);
  });

  it("selects and deselects the whole page", () => {
    const { result } = renderHook(() => useProductSelection(products));
    act(() => result.current.toggleAll());
    expect(result.current.isAllSelected).toBe(true);
    act(() => result.current.toggleAll());
    expect(result.current.count).toBe(0);
  });

  it("removes and clears", () => {
    const { result } = renderHook(() => useProductSelection(products));
    act(() => result.current.toggleAll());
    act(() => result.current.remove(1));
    expect(result.current.selectedIds).toEqual([2]);
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
  });
});
