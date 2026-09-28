import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePlayground } from "../usePlayground.js";
import { DEFAULT_CODE } from "../defaultCode.js";

describe("usePlayground", () => {
  it("warns instead of running empty code", () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => usePlayground({ showToast }));
    act(() => result.current.setCode("   "));
    act(() => result.current.run());
    expect(showToast).toHaveBeenCalledWith("Please enter some code", "warning");
  });

  it("runs code and captures the result", () => {
    const { result } = renderHook(() => usePlayground({ showToast: vi.fn() }));
    act(() => result.current.setCode("return 6 * 7;"));
    act(() => result.current.run());
    expect(result.current.output).toContainEqual({
      type: "result",
      args: "42",
    });
  });

  it("resets to the default snippet", () => {
    const { result } = renderHook(() => usePlayground({ showToast: vi.fn() }));
    act(() => result.current.setCode("x"));
    expect(result.current.isDefaultCode).toBe(false);
    act(() => result.current.resetCode());
    expect(result.current.code).toBe(DEFAULT_CODE);
  });
});
