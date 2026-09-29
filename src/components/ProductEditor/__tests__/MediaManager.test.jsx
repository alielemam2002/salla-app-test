import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MediaManager from "../MediaManager.jsx";
import { uploadProductImageFile } from "../../../utils/productMediaApi.js";

vi.mock("../../../utils/productMediaApi.js", () => ({
  uploadProductImageFile: vi.fn(),
}));

const jpeg = (name) =>
  new File([new Uint8Array(100)], name, { type: "image/jpeg" });

/** Uploads that stay open until the test resolves them. */
function controllableUploads() {
  const pending = [];
  uploadProductImageFile.mockImplementation(
    ({ file, signal }) =>
      new Promise((resolve) => {
        const entry = { name: file.name, resolve };
        signal?.addEventListener("abort", () =>
          resolve({ success: false, code: "aborted" }),
        );
        pending.push(entry);
      }),
  );
  return pending;
}

function renderManager(props = {}) {
  const onMediaChanged = vi.fn();
  render(
    <MediaManager
      productId={55}
      token="tok"
      images={[{ id: 1, sort: 4, type: "image" }]}
      altText="Tee"
      onMediaChanged={onMediaChanged}
      onAddVideo={vi.fn().mockResolvedValue(true)}
      isAddingVideo={false}
      {...props}
    />,
  );
  return { onMediaChanged };
}

const pick = (files) =>
  fireEvent.change(
    screen.getByLabelText("اختر الملفات", { selector: "input" }),
    {
      target: { files },
    },
  );

describe("MediaManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let n = 0;
    globalThis.URL.createObjectURL = vi.fn(() => `blob:preview-${(n += 1)}`);
    globalThis.URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it("queues picked files and explains the ones Salla won't take", () => {
    renderManager();
    pick([
      jpeg("front.jpg"),
      new File([new Uint8Array(10)], "clip.mp4", { type: "video/mp4" }),
    ]);

    expect(screen.getByText("الملفات المختارة (2)")).toBeInTheDocument();
    expect(screen.getByText("front.jpg")).toBeInTheDocument();
    expect(screen.getByText(/رفع ملفات الفيديو غير مدعوم/)).toBeInTheDocument();
    // Only the valid image is offered for upload and gets a preview URL.
    expect(
      screen.getByRole("button", { name: "رفع 1 صورة" }),
    ).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(uploadProductImageFile).not.toHaveBeenCalled();
  });

  it("uploads two at a time, retries only the failed file, then refreshes once", async () => {
    const uploads = controllableUploads();
    const { onMediaChanged } = renderManager();
    pick([jpeg("a.jpg"), jpeg("b.jpg"), jpeg("c.jpg")]);
    fireEvent.click(screen.getByRole("button", { name: "رفع 3 صور" }));

    await waitFor(() => expect(uploads).toHaveLength(2));
    expect(uploadProductImageFile.mock.calls[0][0]).toMatchObject({
      productId: 55,
      token: "tok",
      alt: "Tee",
      sort: 5, // after the product's current images
    });

    uploads[0].resolve({ success: true });
    await waitFor(() => expect(uploads).toHaveLength(3));
    uploads[1].resolve({ success: false, status: 429 });
    uploads[2].resolve({ success: true });

    expect(await screen.findByText("اكتمل الرفع")).toBeInTheDocument();
    expect(screen.getByText("✓ 2 تم رفعها")).toBeInTheDocument();
    expect(screen.getByText("✕ 1 فشلت")).toBeInTheDocument();
    expect(screen.getByText(/طلبات كثيرة/)).toBeInTheDocument();
    expect(onMediaChanged).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => expect(uploads).toHaveLength(4));
    expect(uploads[3].name).toBe("b.jpg");
    uploads[3].resolve({ success: true });
    expect(await screen.findByText("✓ 3 تم رفعها")).toBeInTheDocument();
    expect(onMediaChanged).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "تم" }));
    expect(screen.queryByText(/الملفات المختارة/)).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
  });

  it("cancels everything that hasn't finished", async () => {
    const uploads = controllableUploads();
    const { onMediaChanged } = renderManager();
    pick([jpeg("a.jpg"), jpeg("b.jpg"), jpeg("c.jpg")]);
    fireEvent.click(screen.getByRole("button", { name: "رفع 3 صور" }));
    await waitFor(() => expect(uploads).toHaveLength(2));

    fireEvent.click(screen.getByRole("button", { name: "إلغاء الكل" }));
    expect(await screen.findByText("3 أُلغيت")).toBeInTheDocument();
    expect(uploads).toHaveLength(2); // c.jpg never started
    expect(onMediaChanged).not.toHaveBeenCalled();
  });

  it("stops accepting files once the product has 10 images", () => {
    const images = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));
    renderManager({ images });
    expect(screen.getByText(/الحد الأقصى من الصور/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "اختر الملفات" })).toBeDisabled();
  });

  it("adds a YouTube link and rejects other links", async () => {
    const onAddVideo = vi.fn().mockResolvedValue(true);
    renderManager({ onAddVideo });
    const input = screen.getByLabelText("إضافة فيديو من يوتيوب");

    fireEvent.change(input, { target: { value: "https://vimeo.com/1" } });
    fireEvent.click(screen.getByRole("button", { name: "إضافة الفيديو" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/يوتيوب صحيح/);
    expect(onAddVideo).not.toHaveBeenCalled();

    fireEvent.change(input, {
      target: { value: "https://youtu.be/dmqWuUeA5Ug" },
    });
    fireEvent.click(screen.getByRole("button", { name: "إضافة الفيديو" }));
    await waitFor(() =>
      expect(onAddVideo).toHaveBeenCalledWith("https://youtu.be/dmqWuUeA5Ug"),
    );
    await waitFor(() => expect(input).toHaveValue(""));
  });
});
