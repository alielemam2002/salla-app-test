import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTestConsole } from "../useTestConsole.js";

function setup(overrides = {}) {
  const props = {
    logMessage: vi.fn(),
    copyLog: vi.fn().mockResolvedValue(true),
    showToast: vi.fn(),
    ...overrides,
  };
  const hook = renderHook(() => useTestConsole(props));
  return { ...hook, props };
}

describe("useTestConsole", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores the last clicked event for the payload editor", () => {
    const { result } = setup();
    expect(result.current.eventPayload).toBeNull();
    act(() => result.current.handleEventClick("embedded::ready", { a: 1 }));
    expect(result.current.eventPayload).toEqual({
      eventName: "embedded::ready",
      payload: { a: 1 },
    });
  });

  it("reports an error when there is no parent window", () => {
    const { result, props } = setup();
    const payload = { event: "embedded::ready" };
    act(() => result.current.handleSendCustom(payload));
    expect(props.showToast).toHaveBeenCalledWith(
      expect.stringContaining("No parent window"),
      "error",
    );
    expect(props.logMessage).toHaveBeenCalledWith(
      "outgoing",
      payload,
      "No parent window",
    );
  });

  it("posts to the parent window when embedded", () => {
    const postMessage = vi.fn();
    vi.spyOn(window, "parent", "get").mockReturnValue({ postMessage });
    const { result, props } = setup();
    const payload = { event: "embedded::ready" };
    act(() => result.current.handleSendCustom(payload));
    expect(postMessage).toHaveBeenCalledWith(payload, "*");
    expect(props.logMessage).toHaveBeenCalledWith("outgoing", payload);
  });

  it("toasts the copy result", async () => {
    const { result, props } = setup({
      copyLog: vi.fn().mockResolvedValue(false),
    });
    await act(() => result.current.handleCopyLog());
    expect(props.showToast).toHaveBeenCalledWith("Failed to copy log", "error");
  });
});
