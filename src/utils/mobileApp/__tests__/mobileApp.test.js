import { describe, expect, it, vi } from "vitest";

const memoryKv = new Map();
vi.mock("../../../../api/_lib/kv.js", () => ({
  kvGetJson: vi.fn(async (key) => memoryKv.get(key) || null),
  kvSetJson: vi.fn(async (key, val) => {
    memoryKv.set(key, val);
    return val;
  }),
}));

import {
  createBuildJob,
  generatePackageName,
  getDeviceTokens,
  getPushHistory,
  isValidPackageName,
  registerPushToken,
  sendPushNotification,
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

  describe("createBuildJob", () => {
    it("creates a build record with native flags defaulting to true", async () => {
      const record = await createBuildJob("9911", {
        appName: "متجر تجربة",
        storeUrl: "https://test.salla.sa",
        packageName: "sa.salla.app.test_9911",
      });

      expect(record.bottomNavEnabled).toBe(true);
      expect(record.pullToRefresh).toBe(true);
      expect(record.status).toBe("QUEUED");
      expect(record.merchantId).toBe("9911");
    });

    it("respects customized bottomNavEnabled and pullToRefresh settings", async () => {
      const record = await createBuildJob("9922", {
        appName: "متجر مخصص",
        storeUrl: "https://custom.salla.sa",
        packageName: "sa.salla.app.custom_9922",
        bottomNavEnabled: false,
        pullToRefresh: false,
      });

      expect(record.bottomNavEnabled).toBe(false);
      expect(record.pullToRefresh).toBe(false);
    });
  });

  describe("Push Notifications", () => {
    it("registers and retrieves device push tokens uniquely", async () => {
      const reg1 = await registerPushToken("7788", {
        token: "ExponentPushToken[abc12345]",
        platform: "android",
      });
      expect(reg1.success).toBe(true);
      expect(reg1.count).toBe(1);

      // Duplicate token registration updates instead of duplicating
      const reg2 = await registerPushToken("7788", {
        token: "ExponentPushToken[abc12345]",
        platform: "android",
      });
      expect(reg2.count).toBe(1);

      // Second unique token
      const reg3 = await registerPushToken("7788", {
        token: "ExponentPushToken[xyz99999]",
        platform: "android",
      });
      expect(reg3.count).toBe(2);

      const tokens = await getDeviceTokens("7788");
      expect(tokens.length).toBe(2);
    });

    it("sends push notification and records history", async () => {
      const notification = await sendPushNotification("7788", {
        title: "🔥 عرض الجمعة البيضاء",
        body: "خصم 30% على كل المتجر",
        url: "/offers",
      });

      expect(notification.title).toBe("🔥 عرض الجمعة البيضاء");
      expect(notification.recipientsCount).toBe(2);
      expect(notification.id).toContain("push_");

      const history = await getPushHistory("7788");
      expect(history.length).toBe(1);
      expect(history[0].title).toBe("🔥 عرض الجمعة البيضاء");
    });

    it("validates missing title or body", async () => {
      await expect(
        sendPushNotification("7788", { title: "", body: "محتوى" }),
      ).rejects.toThrow("عنوان الإشعار مطلوب");

      await expect(
        sendPushNotification("7788", { title: "عنوان", body: "" }),
      ).rejects.toThrow("نص الإشعار مطلوب");
    });
  });
});
