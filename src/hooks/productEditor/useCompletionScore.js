import { useMemo } from "react";
import { calculateCompletionScore } from "../../utils/productCompletion.js";

/**
 * Live completion score from the current form values, gallery and the
 * product's options/variants (query data first, product payload as fallback).
 */
export function useCompletionScore({
  values,
  images,
  options,
  variants,
  product,
}) {
  return useMemo(
    () =>
      calculateCompletionScore({
        ...values,
        images,
        options: options.length > 0 ? options : product?.options || [],
        variants:
          variants.length > 0
            ? variants
            : product?.skus || product?.variants || [],
        thumbnail: images[0]?.original || product?.thumbnail,
      }),
    [values, images, options, variants, product],
  );
}
