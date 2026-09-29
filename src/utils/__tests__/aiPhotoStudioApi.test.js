import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateStudioPhotos,
  uploadStudioImageToSalla,
  urlToFile,
} from "../aiPhotoStudioApi.js";
import * as mediaApi from "../productMediaApi.js";

vi.mock("../productMediaApi.js", () => ({
  uploadProductImageFile: vi.fn(),
}));

describe("aiPhotoStudioApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe("generateStudioPhotos", () => {
    it("calls /api/ai-photo-studio with product details and returns photos", async () => {
      const mockResult = {
        success: true,
        data: {
          productName: "عطر فاخر",
          style: "marble_studio",
          photos: [
            {
              id: "photo-1",
              title: "رخام",
              url: "https://example.com/p1.jpg",
            },
          ],
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const res = await generateStudioPhotos({
        product: { name: "عطر فاخر", category: "عطور" },
        style: "marble_studio",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/ai-photo-studio",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(res.photos).toHaveLength(1);
      expect(res.photos[0].title).toBe("رخام");
    });

    it("throws error when API response is not ok", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: "فشل التوليد" }),
      });

      await expect(
        generateStudioPhotos({ product: { name: "منتج" } }),
      ).rejects.toThrow("فشل التوليد");
    });
  });

  describe("urlToFile", () => {
    it("converts fetched blob into File object", async () => {
      const mockBlob = new Blob(["test"], { type: "image/jpeg" });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      const file = await urlToFile("https://example.com/test.jpg", "custom.jpg");
      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe("custom.jpg");
    });
  });

  describe("uploadStudioImageToSalla", () => {
    it("fetches blob, creates file, and calls uploadProductImageFile", async () => {
      const mockBlob = new Blob(["fake-image-bytes"], { type: "image/jpeg" });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob,
      });

      mediaApi.uploadProductImageFile.mockResolvedValueOnce({
        success: true,
        image: { id: "img-123", url: "https://salla.sa/img.jpg" },
      });

      const result = await uploadStudioImageToSalla({
        token: "tok_123",
        productId: "999",
        imageUrl: "https://example.com/photo.jpg",
        title: "صورة استوديو رخامي",
      });

      expect(global.fetch).toHaveBeenCalledWith("https://example.com/photo.jpg");
      expect(mediaApi.uploadProductImageFile).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "tok_123",
          productId: "999",
          alt: "صورة استوديو رخامي",
        }),
      );
      expect(result.success).toBe(true);
      expect(result.image.id).toBe("img-123");
    });

    it("returns error if imageUrl is missing", async () => {
      const res = await uploadStudioImageToSalla({
        token: "tok",
        productId: "999",
        imageUrl: "",
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("رابط الصورة غير صالح");
    });
  });
});
