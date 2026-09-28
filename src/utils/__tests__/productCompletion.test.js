import { calculateCompletionScore } from "../productCompletion.js";

describe("productCompletion", () => {
  it("calculates 0% for an empty product object", () => {
    const res = calculateCompletionScore({});
    expect(res.score).toBe(0);
    expect(res.isComplete).toBe(false);
    expect(res.remainingItems.length).toBeGreaterThan(0);
    expect(res.completedItems.length).toBe(0);
  });

  it("calculates 100% for a fully populated product", () => {
    const completeProduct = {
      name: "T-Shirt Premium",
      description: "<p>Great cotton t-shirt with modern fit.</p>",
      categories: [101],
      brand_id: 202,
      images: [
        { original: "https://example.com/1.jpg" },
        { original: "https://example.com/2.jpg" },
      ],
      promotion_title: "عرض نهاية الموسم",
      subtitle: "خامة قطنية 100%",
      tags: ["summer", "cotton"],
      metadata_title: "قميص قطني فاخر | متجرنا",
      metadata_description: "تسوق قميص قطني فاخر بأفضل الأسعار وخامات عالية الجودة",
      metadata_url: "premium-cotton-tshirt",
      price: 150,
      cost_price: 60,
      quantity: 25,
      sku: "TS-PREM-01",
      gtin: "1234567890123",
      mpn: "MPN-9988",
      options: [{ id: 1, name: "المقاس" }],
    };

    const res = calculateCompletionScore(completeProduct);
    expect(res.score).toBe(100);
    expect(res.isComplete).toBe(true);
    expect(res.remainingItems.length).toBe(0);
    expect(res.sections.basicInfo.isComplete).toBe(true);
    expect(res.sections.appearance.isComplete).toBe(true);
    expect(res.sections.seo.isComplete).toBe(true);
    expect(res.sections.pricingInventory.isComplete).toBe(true);
    expect(res.sections.variants.isComplete).toBe(true);
  });

  it("dynamically increases score when a missing field is added", () => {
    const baseProduct = {
      name: "Basic Product",
      price: 100,
      quantity: 10,
    };

    const before = calculateCompletionScore(baseProduct);
    expect(before.sections.seo.currentScore).toBe(0);

    // Add SEO Title
    const after = calculateCompletionScore({
      ...baseProduct,
      metadata_title: "My SEO Title",
    });

    expect(after.score).toBeGreaterThan(before.score);
    expect(after.sections.seo.fields.seoTitle).toBe(true);
  });

  it("handles unlimited quantity as valid quantity", () => {
    const product = {
      name: "Digital Download",
      price: 50,
      unlimited_quantity: true,
    };

    const res = calculateCompletionScore(product);
    expect(res.sections.pricingInventory.fields.quantity).toBe(true);
  });

  it("reports section weights and gains as points of the final 0-100 score", () => {
    const res = calculateCompletionScore({});
    const totalTarget = Object.values(res.sections).reduce(
      (sum, sec) => sum + sec.targetWeight,
      0,
    );
    expect(Math.round(totalTarget)).toBe(100);

    const totalGain = res.remainingItems.reduce((sum, item) => sum + item.gain, 0);
    expect(Math.round(totalGain)).toBe(100);
  });

  it("predicts the score reached after completing a missing item", () => {
    const base = { name: "Basic Product", price: 100, quantity: 10 };
    const before = calculateCompletionScore(base);
    const item = before.remainingItems.find((i) => i.key === "seoTitle");

    const after = calculateCompletionScore({ ...base, metadata_title: "Title" });
    expect(item.expectedScore).toBe(after.score);
  });

  it("recognizes promotional_title and sub_title aliases in completion score", () => {
    const res = calculateCompletionScore({
      name: "Product with Aliases",
      price: 100,
      promotional_title: "خصم 20%",
      sub_title: "وصف مميز",
    });
    expect(res.sections.appearance.fields.promotionTitle).toBe(true);
    expect(res.sections.appearance.fields.subtitle).toBe(true);
  });
});
