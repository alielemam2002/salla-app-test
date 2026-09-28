import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDisclosure } from "../useDisclosure.js";
import { useAsyncAction } from "../useAsyncAction.js";
import { useClipboard } from "../useClipboard.js";

describe("useDisclosure", () => {
  it("opens with data and closes", () => {
    const { result } = renderHook(() => useDisclosure());
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.open({ id: 7 }));
    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toEqual({ id: 7 });
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBeNull();
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);
  });
});

describe("useAsyncAction", () => {
  it("tracks pending and returns the result", async () => {
    let resolve;
    const fn = vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { result } = renderHook(() => useAsyncAction(fn));
    let promise;
    act(() => {
      promise = result.current.run(1, 2);
    });
    expect(result.current.pending).toBe(true);
    expect(fn).toHaveBeenCalledWith(1, 2);
    await act(async () => {
      resolve("ok");
      expect(await promise).toBe("ok");
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("captures thrown errors", async () => {
    const { result } = renderHook(() =>
      useAsyncAction(async () => {
        throw new Error("boom");
      }),
    );
    let value;
    await act(async () => {
      value = await result.current.run();
    });
    expect(value).toBeUndefined();
    expect(result.current.error).toBe("boom");
    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });
});

describe("useClipboard", () => {
  it("writes text and flips copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const { result } = renderHook(() => useClipboard());
    let ok;
    await act(async () => {
      ok = await result.current.copy("hi");
    });
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hi");
    expect(result.current.copied).toBe(true);
  });

  it("returns false when the clipboard rejects", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    const { result } = renderHook(() => useClipboard());
    let ok;
    await act(async () => {
      ok = await result.current.copy("hi");
    });
    expect(ok).toBe(false);
    expect(result.current.copied).toBe(false);
  });
});
