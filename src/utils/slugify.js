/**
 * Normalise a product SEO slug (metadata_url).
 * Keeps Arabic and Latin letters/digits, lowercases Latin, turns spaces and
 * separators into single hyphens, and strips leading/trailing hyphens.
 */
export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_/\\]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
