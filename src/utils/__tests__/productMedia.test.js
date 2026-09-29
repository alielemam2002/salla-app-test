import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_STATUS,
  describeUploadError,
  formatBytes,
  initialQueueState,
  isYoutubeUrl,
  prepareFiles,
  queueReducer,
  remainingImageSlots,
  summarizeQueue,
  validateMediaFile,
} from "../productMedia.js";

const file = (name, type, size = 1000) => ({ name, type, size });

describe("validateMediaFile", () => {
  it("accepts common product photos", () => {
    expect(validateMediaFile(file("a.jpg", "image/jpeg"))).toBeNull();
    expect(validateMediaFile(file("b.WEBP", "image/webp"))).toBeNull();
    expect(validateMediaFile(file("c.png", "image/png"))).toBeNull();
  });

  it("explains that video files aren't supported by Salla", () => {
    expect(validateMediaFile(file("v.mp4", "video/mp4"))).toMatch(/يوتيوب/);
    // Video extension even when the browser reports no type.
    expect(validateMediaFile(file("v.mov", ""))).toMatch(/يوتيوب/);
  });

  it("rejects non-images, SVG, mismatched extensions, empty and large files", () => {
    expect(validateMediaFile(file("doc.pdf", "application/pdf"))).toMatch(
      /ليس صورة/,
    );
    expect(validateMediaFile(file("x.svg", "image/svg+xml"))).toMatch(
      /ليس صورة/,
    );
    expect(validateMediaFile(file("photo.txt", "image/jpeg"))).toMatch(
      /امتداد/,
    );
    expect(validateMediaFile(file("a.jpg", "image/jpeg", 0))).toMatch(/فارغ/);
    expect(
      validateMediaFile(file("a.jpg", "image/jpeg", MAX_UPLOAD_BYTES + 1)),
    ).toMatch(/الحد المسموح/);
  });
});

describe("helpers", () => {
  it("formats sizes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(2.4 * 1024 * 1024)).toBe("2.4 MB");
  });

  it("recognises YouTube links only", () => {
    expect(isYoutubeUrl("https://www.youtube.com/watch?v=dmqWuUeA5Ug")).toBe(
      true,
    );
    expect(isYoutubeUrl("https://youtu.be/dmqWuUeA5Ug")).toBe(true);
    expect(isYoutubeUrl("https://vimeo.com/123456")).toBe(false);
    expect(isYoutubeUrl("http://youtube.com/watch?v=dmqWuUeA5Ug")).toBe(false);
  });

  it("describes upload failures without raw API errors", () => {
    expect(describeUploadError({ status: 413 })).toMatch(/حجم الملف/);
    expect(describeUploadError({ status: 415 })).toMatch(/نوع الملف/);
    expect(describeUploadError({ status: 429 })).toMatch(/دقيقة/);
    expect(describeUploadError({ status: 0, code: "network_error" })).toMatch(
      /الاتصال/,
    );
    expect(describeUploadError({ status: 0, code: "timeout" })).toMatch(/مهلة/);
    expect(
      describeUploadError({ status: 422, error: "alert.invalid_fields" }),
    ).not.toMatch(/alert\./);
    expect(describeUploadError({ status: 503 })).toMatch(/مؤقت/);
  });
});

describe("image limit", () => {
  const existing = [
    { id: 1, type: "image" },
    { id: 2, type: "video" },
    { id: 3 },
  ];

  it("counts images (not videos) and queued files against Salla's 10", () => {
    const items = [
      { status: UPLOAD_STATUS.PENDING },
      { status: UPLOAD_STATUS.UPLOADED },
      { status: UPLOAD_STATUS.FAILED },
    ];
    expect(remainingImageSlots(existing, items)).toBe(7);
  });

  it("marks files past the limit instead of dropping them", () => {
    const picked = [
      file("a.jpg", "image/jpeg"),
      file("v.mp4", "video/mp4"),
      file("b.jpg", "image/jpeg"),
    ];
    const prepared = prepareFiles(picked, 1);
    expect(prepared[0].error).toBeNull();
    expect(prepared[1].error).toMatch(/يوتيوب/);
    expect(prepared[2].error).toMatch(/10/);
  });
});

describe("queueReducer", () => {
  const add = (state, names) =>
    queueReducer(state, {
      type: "add",
      entries: names.map((name) => ({
        file: file(name, "image/jpeg"),
        previewUrl: `blob:${name}`,
      })),
    });

  it("runs a file through uploading → uploaded", () => {
    let state = add(initialQueueState, ["a.jpg"]);
    const { id } = state.items[0];
    state = queueReducer(state, { type: "uploading", id });
    state = queueReducer(state, { type: "progress", id, progress: 0.5 });
    expect(state.items[0]).toMatchObject({
      status: "uploading",
      progress: 0.5,
      processing: false,
    });
    state = queueReducer(state, { type: "progress", id, progress: 1 });
    expect(state.items[0].processing).toBe(true);
    state = queueReducer(state, { type: "uploaded", id });
    expect(state.items[0]).toMatchObject({ status: "uploaded", progress: 1 });
  });

  it("cancels only pending/uploading files and retries only the chosen ones", () => {
    let state = add(initialQueueState, ["a.jpg", "b.jpg", "c.jpg"]);
    const [a, b, c] = state.items.map((it) => it.id);
    state = queueReducer(state, { type: "uploaded", id: a });
    state = queueReducer(state, { type: "failed", id: b, error: "x" });
    state = queueReducer(state, { type: "cancel", ids: [a, b, c] });
    expect(state.items.map((it) => it.status)).toEqual([
      "uploaded",
      "failed",
      "cancelled",
    ]);
    state = queueReducer(state, { type: "retry", ids: [b] });
    expect(state.items.map((it) => it.status)).toEqual([
      "uploaded",
      "pending",
      "cancelled",
    ]);
  });

  it("never retries a file that failed validation", () => {
    let state = queueReducer(initialQueueState, {
      type: "add",
      entries: [{ file: file("v.mp4", "video/mp4"), error: "no" }],
    });
    const { id } = state.items[0];
    expect(state.items[0]).toMatchObject({ status: "failed", rejected: true });
    state = queueReducer(state, { type: "retry", ids: [id] });
    expect(state.items[0].status).toBe("failed");
  });

  it("keeps a single main image and clears finished files", () => {
    let state = add(initialQueueState, ["a.jpg", "b.jpg"]);
    const [a, b] = state.items.map((it) => it.id);
    state = queueReducer(state, { type: "setMain", id: a });
    state = queueReducer(state, { type: "setMain", id: b });
    expect(state.items.map((it) => it.main)).toEqual([false, true]);

    state = queueReducer(state, { type: "uploaded", id: a });
    state = queueReducer(state, { type: "clearFinished" });
    expect(state.items.map((it) => it.id)).toEqual([b]);
    expect(summarizeQueue(state.items)).toMatchObject({ total: 1, pending: 1 });
  });
});
