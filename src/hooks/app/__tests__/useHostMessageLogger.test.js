import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHostMessageLogger } from "../useHostMessageLogger.js";

function dispatch(data, origin) {
  window.dispatchEvent(new MessageEvent("message", { data, origin }));
}

describe("useHostMessageLogger", () => {
  it("logs embedded:: messages and records a foreign origin", () => {
    const logMessage = vi.fn();
    const setParentOrigin = vi.fn();
    renderHook(() => useHostMessageLogger({ logMessage, setParentOrigin }));

    const data = { event: "embedded::ready" };
    dispatch(data, "https://s.salla.sa");

    expect(logMessage).toHaveBeenCalledWith(
      "incoming",
      data,
      null,
      "https://s.salla.sa",
    );
    expect(setParentOrigin).toHaveBeenCalledWith("https://s.salla.sa");
  });

  it("ignores other messages", () => {
    const logMessage = vi.fn();
    renderHook(() =>
      useHostMessageLogger({ logMessage, setParentOrigin: vi.fn() }),
    );
    dispatch({ event: "other::thing" }, "https://x.test");
    dispatch("plain string", "https://x.test");
    expect(logMessage).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", () => {
    const logMessage = vi.fn();
    const { unmount } = renderHook(() =>
      useHostMessageLogger({ logMessage, setParentOrigin: vi.fn() }),
    );
    unmount();
    dispatch({ event: "embedded::ready" }, "https://s.salla.sa");
    expect(logMessage).not.toHaveBeenCalled();
  });
});
