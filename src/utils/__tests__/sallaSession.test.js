import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isSessionInvalidError,
  refreshSallaSession,
  _resetRefreshCooldown,
} from "../sallaSession.js";

describe("sallaSession", () => {
  let originalParent;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetRefreshCooldown();
    originalParent = window.parent;
  });

  afterEach(() => {
    Object.defineProperty(window, "parent", {
      value: originalParent,
      writable: true,
      configurable: true,
    });
  });

  describe("isSessionInvalidError", () => {
    it("detects code === session_invalid", () => {
      expect(isSessionInvalidError({ code: "session_invalid" })).toBe(true);
    });

    it("detects result.code === session_invalid", () => {
      expect(isSessionInvalidError({ result: { code: "session_invalid" } })).toBe(true);
    });

    it("detects 401 with session message", () => {
      expect(
        isSessionInvalidError({
          status: 401,
          message: "انتهت جلسة سلة أو أنها غير صالحة.",
        }),
      ).toBe(true);
      expect(
        isSessionInvalidError({
          result: {
            status: 401,
            error: "لم يتم العثور على رمز الجلسة",
          },
        }),
      ).toBe(true);
    });

    it("returns false for non-session errors", () => {
      expect(isSessionInvalidError(null)).toBe(false);
      expect(isSessionInvalidError(undefined)).toBe(false);
      expect(isSessionInvalidError({ code: "network_error" })).toBe(false);
      expect(isSessionInvalidError({ status: 500, message: "Internal Error" })).toBe(false);
    });
  });

  describe("refreshSallaSession", () => {
    it("calls embedded.auth.refresh() when running inside iframe", () => {
      // Mock window.parent !== window
      Object.defineProperty(window, "parent", {
        value: { postMessage: vi.fn() },
        writable: true,
        configurable: true,
      });

      const mockRefresh = vi.fn();
      const mockToast = vi.fn();
      const mockSdk = { auth: { refresh: mockRefresh } };

      const result = refreshSallaSession(mockSdk, mockToast);

      expect(result).toBe(true);
      expect(mockRefresh).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith(
        "انتهت الجلسة. يجري تحديث الجلسة مع سلة...",
        "info",
      );
    });

    it("throttles multiple refresh calls within cooldown period", () => {
      Object.defineProperty(window, "parent", {
        value: { postMessage: vi.fn() },
        writable: true,
        configurable: true,
      });

      const mockRefresh = vi.fn();
      const mockSdk = { auth: { refresh: mockRefresh } };

      const first = refreshSallaSession(mockSdk);
      const second = refreshSallaSession(mockSdk);

      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it("informs user when running standalone outside iframe", () => {
      // Mock standalone: window.parent === window
      Object.defineProperty(window, "parent", {
        value: window,
        writable: true,
        configurable: true,
      });

      const mockRefresh = vi.fn();
      const mockToast = vi.fn();
      const mockSdk = { auth: { refresh: mockRefresh } };

      const result = refreshSallaSession(mockSdk, mockToast);

      expect(result).toBe(false);
      expect(mockRefresh).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        "انتهت جلسة سلة أو أنها غير صالحة. أعد فتح التطبيق من لوحة سلة.",
        "error",
      );
    });
  });
});
