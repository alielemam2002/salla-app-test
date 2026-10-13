import { useCallback, useRef, useState } from "react";
import {
  AI_RESULTS_MAX,
  AI_TEXT,
  describeAiImageError,
  findStyle,
  findTool,
} from "../../utils/aiImageStudio.js";
import { remainingImageSlots } from "../../utils/productMedia.js";
import {
  attachAiImage,
  generateAiImage,
  improveAiImage,
} from "../../utils/productMediaApi.js";

let nextId = 0;

const maxSort = (images) =>
  (images || []).reduce((max, img) => Math.max(max, Number(img.sort) || 0), 0);

/**
 * Local state of the AI image studio for one product: results (DeepAI
 * previews, newest first), the running request and its error, and adding a
 * result to the product. Like the upload queue, `onAttached` only asks the
 * caller to refetch the product's images, so unsaved form edits stay.
 *
 * Result: { id, url, label, status: "ready" | "attaching" | "attached",
 * main, error }.
 */
export function useAiImageStudio({
  token,
  productId,
  existingImages,
  altText,
  onAttached,
}) {
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(null); // "generate" | "improve" | null
  const [error, setError] = useState(null);
  const lastSort = useRef(0);

  const patch = useCallback(
    (id, fields) =>
      setResults((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...fields } : r)),
      ),
    [],
  );

  const run = useCallback(async (kind, request, label) => {
    setBusy(kind);
    setError(null);
    const result = await request();
    setBusy(null);
    if (!result.success) {
      setError(describeAiImageError(result));
      return false;
    }
    nextId += 1;
    const entry = {
      id: `ai${nextId}`,
      url: result.output.url,
      label,
      status: "ready",
      main: false,
      error: null,
    };
    setResults((prev) => [entry, ...prev].slice(0, AI_RESULTS_MAX));
    return true;
  }, []);

  const generate = useCallback(
    ({ prompt, style, quality }) =>
      run(
        "generate",
        () => generateAiImage({ token, prompt, style, quality }),
        AI_TEXT.generatedLabel(findStyle(style)?.label || ""),
      ),
    [run, token],
  );

  /** `source`: { url } (a product image or a result) or { file }. */
  const improve = useCallback(
    ({ tool, text, source }) =>
      run(
        "improve",
        () =>
          improveAiImage({
            token,
            tool,
            text: findTool(tool)?.needsText ? text : undefined,
            imageUrl: source?.url,
            file: source?.file,
          }),
        findTool(tool)?.label || "",
      ),
    [run, token],
  );

  const attach = useCallback(
    async (id, { main = false } = {}) => {
      const item = results.find((r) => r.id === id);
      if (!item || item.status !== "ready") return false;
      patch(id, { status: "attaching", error: null });

      // New images go after the product's current ones.
      const sort = Math.max(maxSort(existingImages), lastSort.current) + 1;
      lastSort.current = sort;
      const result = await attachAiImage({
        token,
        productId,
        url: item.url,
        main,
        sort,
        alt: altText,
      });
      if (!result.success) {
        patch(id, { status: "ready", error: describeAiImageError(result) });
        return false;
      }
      patch(id, { status: "attached", main });
      onAttached?.();
      return true;
    },
    [results, patch, existingImages, token, productId, altText, onAttached],
  );

  const attaching = results.filter((r) => r.status === "attaching").length;
  const slotsLeft = Math.max(
    0,
    remainingImageSlots(existingImages, []) - attaching,
  );

  return {
    results,
    busy,
    error,
    slotsLeft,
    generate,
    improve,
    attach,
    clearError: () => setError(null),
  };
}
