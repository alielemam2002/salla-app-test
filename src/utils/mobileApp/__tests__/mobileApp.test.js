import { describe, expect, it } from "vitest";
import {
  generatePackageName,
  isValidPackageName,
  validateStoreUrl,
} from "../../../../api/_lib/mobileApp.js";

describe("mobileApp helpers", () => {
  describe("isValidPackageName", () => {
    it("accepts valid Android package names", () => {
      expect(isValidPackageName("com.example.app")).toBe(true);
      expect(isValidPackageName("sa.salla.app.store_123")).toBe(true);
      expect(isValidPackageName("sa.salla.app.m_999")).toBe(true);
    });

    it("rejects invalid package names", () => {
      expect(isValidPackageName("")).toBe(false);
      expect(isValidPackageName("123.com")).toBe(false);
      expect(isValidPackageName("com..app")).toBe(false);
      expect(isValidPackageName("invalid-hyphen.app")).toBe(false);
      expect(isValidPackageName("com.example.")).toBe(false);
    });
  });

  describe("generatePackageName", () => {
    it("generates deterministic package name from merchantId and app name", () => {
      const pkg = generatePackageName(12345, "Nahla Store");
      expect(pkg).toBe("sa.salla.app.nahla_store_12345");
      expect(isValidPackageName(pkg)).toBe(true);
    });

    it("handles Arabic app names gracefully", () => {
      const pkg = generatePackageName("67890", "متجر نحلة");
      expect(pkg).toBe("sa.salla.app.store_67890");
      expect(isValidPackageName(pkg)).toBe(true);
    });

    it("sanitizes spaces and special characters", () => {
      const pkg = generatePackageName(555, "My Super! Store#1");
      expect(pkg).toBe("sa.salla.app.my_super_store_1_555");
      expect(isValidPackageName(pkg)).toBe(true);
    });
  });

  describe("validateStoreUrl", () => {
    it("accepts valid HTTPS URLs", () => {
      const res = validateStoreUrl("https://nahla1.com/ar");
      expect(res.valid).toBe(true);
      expect(res.sanitizedUrl).toBe("https://nahla1.com/ar");
    });

    it("rejects HTTP URLs", () => {
      const res = validateStoreUrl("http://insecure-store.com");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("https://");
    });

    it("blocks localhost and loopback SSRF attempts", () => {
      expect(validateStoreUrl("https://localhost:3000").valid).toBe(false);
      expect(validateStoreUrl("https://127.0.0.1/admin").valid).toBe(false);
      expect(validateStoreUrl("https://192.168.1.1/secret").valid).toBe(false);
      expect(validateStoreUrl("https://10.0.0.1").valid).toBe(false);
    });

    it("validates against merchant verified domain if supplied", () => {
      const valid = validateStoreUrl("https://mystore.com", "mystore.com");
      expect(valid.valid).toBe(true);

      const invalid = validateStoreUrl("https://another-domain.com", "mystore.com");
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain("نطاق متجرك");
    });
  });
});
