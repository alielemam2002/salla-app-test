import { describe, it, expect, vi, afterEach } from "vitest";
import { generateAiProductContent } from "../aiCopilotApi.js";

function mockFetch(response) {
  global.fetch = vi.fn().mockResolvedValue(response);
}

describe("generateAiProductContent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws validation error if product name is missing", async () => {
    await expect(
      generateAiProductContent({ product: { name: "" } }),
    ).rejects.toThrow("اسم المنتج مطلوب لتوليد المحتوى بالذكاء الاصطناعي.");
  });

  it("successfully returns generated AI data on 200 OK", async () => {
    const mockData = {
      marketing_description: "<p>وصف تجريبي</p>",
      short_description: "وصف موجز",
      meta_title: "عنوان سيو ممتاز",
      meta_description: "وصف سيو تشويقي",
      tags: ["عطور", "مسك"],
      seo_slug: "test-product",
    };

    mockFetch(
      new Response(JSON.stringify({ success: true, data: mockData }), {
        status: 200,
      }),
    );

    const result = await generateAiProductContent({
      product: { name: "عطر مسك", category: "عطور", price: 100 },
      tone: "saudi_commercial",
    });

    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ai-copilot",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("عطر مسك"),
      }),
    );
  });

  it("throws server error message when API responds with error", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          success: false,
          error: "تم تجاوز حد الاستعلامات المسموح بها.",
        }),
        { status: 429 },
      ),
    );

    await expect(
      generateAiProductContent({ product: { name: "منتج تجريبي" } }),
    ).rejects.toThrow("تم تجاوز حد الاستعلامات المسموح بها.");
  });
});
