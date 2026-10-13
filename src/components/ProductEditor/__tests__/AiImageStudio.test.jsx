import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MediaManager from "../MediaManager.jsx";
import {
  attachAiImage,
  generateAiImage,
  improveAiImage,
} from "../../../utils/productMediaApi.js";

vi.mock("../../../utils/productMediaApi.js", () => ({
  uploadProductImageFile: vi.fn(),
  generateAiImage: vi.fn(),
  improveAiImage: vi.fn(),
  attachAiImage: vi.fn(),
}));

const RESULT = "https://api.deepai.org/job-view-file/abc/outputs/output.png";
const PRODUCT_IMAGE = "https://cdn.salla.sa/img/front.jpg";

function renderStudio() {
  const onMediaChanged = vi.fn();
  render(
    <MediaManager
      productId={55}
      token="tok"
      images={[
        { id: 1, sort: 4, type: "image", original: PRODUCT_IMAGE, alt: "" },
      ]}
      altText="كوب سيراميك"
      onMediaChanged={onMediaChanged}
      onAddVideo={vi.fn()}
      isAddingVideo={false}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "صور بالذكاء الاصطناعي" }),
  );
  return { onMediaChanged };
}

describe("AI image studio", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates from the product name and adds the result to the product", async () => {
    generateAiImage.mockResolvedValue({
      success: true,
      output: { id: "j1", url: RESULT },
    });
    attachAiImage.mockResolvedValue({ success: true, image: { id: 9 } });
    const { onMediaChanged } = renderStudio();

    expect(screen.getByLabelText("وصف الصورة")).toHaveValue("كوب سيراميك");
    fireEvent.click(screen.getByRole("button", { name: "إنشاء الصورة" }));

    expect(generateAiImage).toHaveBeenCalledWith({
      token: "tok",
      prompt: "كوب سيراميك",
      style: "studio",
      quality: "hd",
    });
    expect(await screen.findByAltText(/صورة جديدة/)).toHaveAttribute(
      "src",
      RESULT,
    );
    // Nothing reaches Salla until the merchant adds it.
    expect(attachAiImage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "إضافة للمنتج" }));
    expect(await screen.findByText("أُضيفت للمنتج")).toBeInTheDocument();
    expect(attachAiImage).toHaveBeenCalledWith({
      token: "tok",
      productId: 55,
      url: RESULT,
      main: false,
      sort: 5,
      alt: "كوب سيراميك",
    });
    expect(onMediaChanged).toHaveBeenCalledTimes(1);
  });

  it("explains DeepAI failures in Arabic", async () => {
    generateAiImage.mockResolvedValue({
      success: false,
      status: 502,
      code: "deepai_not_pro",
    });
    renderStudio();
    fireEvent.click(screen.getByRole("button", { name: "إنشاء الصورة" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "يحتاج اشتراك Pro",
    );
  });

  it("improves a product image, then a result can be improved again", async () => {
    improveAiImage.mockResolvedValue({
      success: true,
      output: { id: "j2", url: RESULT },
    });
    renderStudio();
    fireEvent.click(screen.getByRole("tab", { name: "تحسين صورة" }));

    const submit = screen.getByRole("button", { name: "تحسين الصورة" });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "صورة المنتج 1" }));
    fireEvent.click(submit);

    expect(improveAiImage).toHaveBeenCalledWith({
      token: "tok",
      tool: "remove_background",
      text: undefined,
      imageUrl: PRODUCT_IMAGE,
      file: undefined,
    });
    await screen.findByAltText("إزالة الخلفية");

    // Use the result as the next source, with the description editor.
    fireEvent.click(screen.getByRole("button", { name: "تحسين هذه الصورة" }));
    fireEvent.click(screen.getByRole("button", { name: /تعديل بالوصف/ }));
    const run = screen.getByRole("button", { name: "تحسين الصورة" });
    expect(run).toBeDisabled();
    fireEvent.change(screen.getByLabelText("التعديل المطلوب"), {
      target: { value: "on a marble table" },
    });
    fireEvent.click(run);
    await waitFor(() => expect(improveAiImage).toHaveBeenCalledTimes(2));
    expect(improveAiImage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tool: "edit",
        text: "on a marble table",
        imageUrl: RESULT,
      }),
    );
  });
});
