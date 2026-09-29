import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AiPhotoStudioModal from "../AiPhotoStudioModal.jsx";
import * as studioApi from "../../../utils/aiPhotoStudioApi.js";

vi.mock("../../../utils/aiPhotoStudioApi.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateStudioPhotos: vi.fn(),
    uploadStudioImageToSalla: vi.fn(),
  };
});

describe("AiPhotoStudioModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(
      <AiPhotoStudioModal
        isOpen={false}
        onClose={vi.fn()}
        product={{ name: "ساعة فاخرة" }}
      />,
    );
    expect(
      screen.queryByText(/استوديو تصوير المنتجات بالذكاء الاصطناعي/),
    ).not.toBeInTheDocument();
  });

  it("renders with style presets when open", () => {
    render(
      <AiPhotoStudioModal
        isOpen={true}
        onClose={vi.fn()}
        product={{ name: "ساعة فاخرة" }}
      />,
    );

    expect(
      screen.getByText("استوديو تصوير المنتجات بالذكاء الاصطناعي (مجاني)"),
    ).toBeInTheDocument();
    expect(screen.getByText("استوديو رخامي فخم")).toBeInTheDocument();
    expect(screen.getByText("بيئة طبيعية عصرية (Lifestyle)")).toBeInTheDocument();
    expect(screen.getByText("جلسة إهداء وتغليف راقٍ")).toBeInTheDocument();
    expect(screen.getByText("إعلان تجاري عصري (Pop)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /بدء جلسة التصوير الفوتوغرافي/i }),
    ).toBeInTheDocument();
  });

  it("generates photos and allows uploading to Salla", async () => {
    const mockPhotos = [
      {
        id: "p-1",
        title: "لقطة رخامية",
        url: "https://example.com/p1.jpg",
      },
      {
        id: "p-2",
        title: "لقطة إضاءة دافئة",
        url: "https://example.com/p2.jpg",
      },
    ];

    studioApi.generateStudioPhotos.mockResolvedValueOnce({
      productName: "ساعة فاخرة",
      style: "marble_studio",
      photos: mockPhotos,
    });

    studioApi.uploadStudioImageToSalla.mockResolvedValue({
      success: true,
      image: { id: "img-1", url: "https://salla.sa/img1.jpg" },
    });

    const onImagesUploaded = vi.fn();
    const onClose = vi.fn();
    const showToast = vi.fn();

    render(
      <AiPhotoStudioModal
        isOpen={true}
        onClose={onClose}
        product={{ name: "ساعة فاخرة", category: "ساعات" }}
        token="tok_test"
        productId="12345"
        onImagesUploaded={onImagesUploaded}
        showToast={showToast}
      />,
    );

    const generateBtn = screen.getByRole("button", {
      name: /بدء جلسة التصوير الفوتوغرافي/i,
    });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(studioApi.generateStudioPhotos).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText("لقطة رخامية")).toBeInTheDocument();
      expect(screen.getByText("لقطة إضاءة دافئة")).toBeInTheDocument();
    });

    const uploadBtn = screen.getByRole("button", {
      name: /رفع الصور المختارة لسلة/i,
    });
    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(studioApi.uploadStudioImageToSalla).toHaveBeenCalled();
      expect(onImagesUploaded).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
