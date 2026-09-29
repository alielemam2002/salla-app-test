import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  UPLOAD_CONCURRENCY,
  UPLOAD_STATUS,
  describeUploadError,
  initialQueueState,
  prepareFiles,
  queueReducer,
  remainingImageSlots,
  summarizeQueue,
} from "../../utils/productMedia.js";
import { uploadProductImageFile } from "../../utils/productMediaApi.js";

/**
 * Local state for the bulk image upload of one product: picked files,
 * validation, a queue with limited concurrency, per-file progress, cancel
 * (AbortController) and retry of single files. Server data stays in
 * TanStack Query: `onBatchDone` is called when the queue goes idle after
 * uploading something, so the caller can refetch the product's images.
 */
export function useMediaUploadQueue({
  token,
  productId,
  existingImages,
  altText,
  onBatchDone,
}) {
  const [state, dispatch] = useReducer(queueReducer, initialQueueState);
  const controllers = useRef(new Map());
  const launched = useRef(new Set());
  const nextSort = useRef(null);
  const uploadedInBatch = useRef(0);
  const previewUrls = useRef(new Set());

  const revoke = useCallback((url) => {
    if (url && previewUrls.current.has(url)) {
      URL.revokeObjectURL(url);
      previewUrls.current.delete(url);
    }
  }, []);

  // Release every preview and stop uploads when the editor closes.
  useEffect(() => {
    const urls = previewUrls.current;
    const running = controllers.current;
    return () => {
      running.forEach((controller) => controller.abort());
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const addFiles = useCallback(
    (fileList) => {
      const slots = remainingImageSlots(existingImages, state.items);
      const entries = prepareFiles(fileList, slots).map(({ file, error }) => {
        if (error) return { file, error };
        const previewUrl = URL.createObjectURL(file);
        previewUrls.current.add(previewUrl);
        return { file, previewUrl };
      });
      if (entries.length) dispatch({ type: "add", entries });
    },
    [existingImages, state.items],
  );

  const remove = useCallback(
    (id) => {
      const item = state.items.find((it) => it.id === id);
      if (!item || item.status === UPLOAD_STATUS.UPLOADING) return;
      revoke(item.previewUrl);
      dispatch({ type: "remove", id });
    },
    [state.items, revoke],
  );

  const upload = useCallback(
    async (item) => {
      const controller = new AbortController();
      controllers.current.set(item.id, controller);
      dispatch({ type: "uploading", id: item.id });

      const sort = nextSort.current;
      nextSort.current += 1;
      const result = await uploadProductImageFile({
        token,
        productId,
        file: item.file,
        main: item.main,
        sort,
        alt: altText,
        signal: controller.signal,
        onProgress: (progress) =>
          dispatch({ type: "progress", id: item.id, progress }),
      });

      controllers.current.delete(item.id);
      launched.current.delete(item.id);
      if (result.success) {
        uploadedInBatch.current += 1;
        dispatch({ type: "uploaded", id: item.id });
      } else if (result.code !== "aborted") {
        dispatch({
          type: "failed",
          id: item.id,
          error: describeUploadError(result),
        });
      }
    },
    [token, productId, altText],
  );

  // Queue runner: keep up to UPLOAD_CONCURRENCY uploads in flight.
  useEffect(() => {
    if (!state.running) return;
    const active = state.items.filter(
      (it) => it.status === UPLOAD_STATUS.UPLOADING,
    ).length;
    const waiting = state.items.filter(
      (it) =>
        it.status === UPLOAD_STATUS.PENDING && !launched.current.has(it.id),
    );
    if (active === 0 && waiting.length === 0 && launched.current.size === 0) {
      dispatch({ type: "stop" });
      if (uploadedInBatch.current > 0) {
        uploadedInBatch.current = 0;
        onBatchDone?.();
      }
      return;
    }
    const free = UPLOAD_CONCURRENCY - Math.max(active, launched.current.size);
    waiting.slice(0, Math.max(0, free)).forEach((item) => {
      launched.current.add(item.id);
      upload(item);
    });
  }, [state, upload, onBatchDone]);

  const start = useCallback(() => {
    if (nextSort.current === null || !state.running) {
      // New images go after the product's current ones.
      const maxSort = (existingImages || []).reduce(
        (max, img) => Math.max(max, Number(img.sort) || 0),
        0,
      );
      nextSort.current = maxSort + 1;
    }
    dispatch({ type: "start" });
  }, [existingImages, state.running]);

  const cancel = useCallback((ids) => {
    ids.forEach((id) => {
      controllers.current.get(id)?.abort();
      launched.current.delete(id);
    });
    dispatch({ type: "cancel", ids });
  }, []);

  const cancelOne = useCallback((id) => cancel([id]), [cancel]);
  const cancelAll = useCallback(
    () =>
      cancel(
        state.items
          .filter(
            (it) =>
              it.status === UPLOAD_STATUS.PENDING ||
              it.status === UPLOAD_STATUS.UPLOADING,
          )
          .map((it) => it.id),
      ),
    [cancel, state.items],
  );

  const retry = useCallback(
    (ids) => {
      dispatch({ type: "retry", ids });
      start();
    },
    [start],
  );
  const retryOne = useCallback((id) => retry([id]), [retry]);
  const retryFailed = useCallback(
    () =>
      retry(
        state.items
          .filter(
            (it) =>
              !it.rejected &&
              (it.status === UPLOAD_STATUS.FAILED ||
                it.status === UPLOAD_STATUS.CANCELLED),
          )
          .map((it) => it.id),
      ),
    [retry, state.items],
  );

  /** Close the summary: drop finished items and free their previews. */
  const clearFinished = useCallback(() => {
    state.items.forEach((it) => {
      if (
        it.status !== UPLOAD_STATUS.PENDING &&
        it.status !== UPLOAD_STATUS.UPLOADING
      ) {
        revoke(it.previewUrl);
      }
    });
    dispatch({ type: "clearFinished" });
  }, [state.items, revoke]);

  const setMain = useCallback((id) => dispatch({ type: "setMain", id }), []);

  const summary = summarizeQueue(state.items);
  const slotsLeft = remainingImageSlots(existingImages, state.items);
  const hasStarted =
    summary.uploaded + summary.failed + summary.cancelled > 0 && !state.running;

  return {
    items: state.items,
    running: state.running,
    summary,
    slotsLeft,
    // Every uploadable file has finished (uploaded / failed / cancelled).
    isFinished: hasStarted && summary.pending === 0 && summary.uploading === 0,
    addFiles,
    remove,
    start,
    cancelOne,
    cancelAll,
    retryOne,
    retryFailed,
    clearFinished,
    setMain,
  };
}
