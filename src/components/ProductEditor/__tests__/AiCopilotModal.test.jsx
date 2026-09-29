import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AiCopilotModal from "../AiCopilotModal.jsx";
import * as aiApi from "../../../utils/aiCopilotApi.js";

vi.mock("../../../utils/aiCopilotApi.js", () => ({
  generateAiProductContent: vi.fn(),
}));

describe("AiCopilotModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(
      <AiCopilotModal
        isOpen={false}
        onClose={vi.fn()}
        productName="عباية حرير"
        onApply={vi.fn()}
      />,
    );
    expect(screen.queryByText("مساعد الذكاء الاصطناعي")).not.toBeInTheDocument();
  });

  it("renders with tone options when open", () => {
    render(
      <AiCopilotModal
        isOpen={true}
        onClose={vi.fn()}
        productName="عباية حرير فاخرة"
        currentDescription="وصف مبدئي"
        categoryName="أزياء"
        onApply={vi.fn()}
      />,
    );

    expect(screen.getByText("مساعد كتابة المنتجات وتهيئة الـ SEO بالذكاء الاصطناعي")).toBeInTheDocument();
    expect(screen.getByText("لهجة سعودية بيضاء")).toBeInTheDocument();
    expect(screen.getByText("فصحى تجارية أنيقة")).toBeInTheDocument();
    expect(screen.getByText("فخامة ومختصرة")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /بدء التوليد السحري/i })).toBeInTheDocument();
    expect(document.querySelectorAll(".ai-tone-icon svg")).toHaveLength(3);
  });

  it("generates and applies AI content successfully", async () => {
    const mockAiResponse = {
      promotion_title: "الأكثر مبيعاً 🔥",
      subtitle: "عباية راقية بتصميم عصري",
      marketing_description: "<p>وصف تسويقي احترافي ومميز</p>",
      short_description: "وصف ترويجي مختصر",
      meta_title: "عباية حرير فاخرة | أفضل متجر",
      meta_description: "تسوقي أفخم عباية حرير بتطريز أنيق وشحن مجاني.",
      seo_slug: "luxury-silk-abaya",
      tags: ["عبايات", "حرير", "موضة"],
      key_features: ["خامة أصلية 100%"],
    };

    aiApi.generateAiProductContent.mockResolvedValueOnce(mockAiResponse);

    const onApply = vi.fn();
    const onClose = vi.fn();

    render(
      <AiCopilotModal
        isOpen={true}
        onClose={onClose}
        productName="عباية حرير"
        currentDescription="وصف تجريبي"
        categoryName="أزياء"
        onApply={onApply}
      />,
    );

    const generateBtn = screen.getByRole("button", { name: /بدء التوليد السحري/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(aiApi.generateAiProductContent).toHaveBeenCalledWith({
        product: {
          name: "عباية حرير",
          category: "أزياء",
          price: "",
          currency: "ر.س",
          brand: "",
          current_description: "وصف تجريبي",
        },
        tone: "saudi_commercial",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("الأكثر مبيعاً 🔥")).toBeInTheDocument();
      expect(screen.getByText("وصف تسويقي احترافي ومميز")).toBeInTheDocument();
    });

    const applyBtn = screen.getByRole("button", { name: /تطبيق الكل على المنتج/i });
    fireEvent.click(applyBtn);

    expect(onApply).toHaveBeenCalledWith(mockAiResponse);
    expect(onClose).toHaveBeenCalled();
  });
});
