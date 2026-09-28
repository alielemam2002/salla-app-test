import { useMemo, useState } from "react";

export const RECOMMENDATION_CATEGORIES = [
  { id: "all", label: "الكل" },
  { id: "images", label: "الصور" },
  { id: "javascript", label: "جافاسكريبت" },
  { id: "css", label: "تنسيقات CSS" },
  { id: "network", label: "الشبكة والخادم" },
  { id: "rendering", label: "العرض (Rendering)" },
  { id: "layout", label: "استقرار العناصر" },
  { id: "fonts", label: "الخطوط" },
];

/**
 * Category filtering, top-3 highlights and the selected recommendation
 * for the Opportunities section.
 */
export function useRecommendations(recommendations = []) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeRecommendation, setActiveRecommendation] = useState(null);

  const topOpportunities = useMemo(
    () =>
      recommendations
        .filter((r) => r.impact === "high" || r.impact === "medium")
        .slice(0, 3),
    [recommendations],
  );

  // Only categories that have at least one item (plus "all")
  const categories = useMemo(
    () =>
      RECOMMENDATION_CATEGORIES.map((cat) => ({
        ...cat,
        count:
          cat.id === "all"
            ? recommendations.length
            : recommendations.filter((r) => r.category === cat.id).length,
      })).filter((cat) => cat.id === "all" || cat.count > 0),
    [recommendations],
  );

  const filteredList = useMemo(
    () =>
      selectedCategory === "all"
        ? recommendations
        : recommendations.filter((r) => r.category === selectedCategory),
    [recommendations, selectedCategory],
  );

  return {
    categories,
    selectedCategory,
    setSelectedCategory,
    topOpportunities,
    filteredList,
    activeRecommendation,
    openRecommendation: setActiveRecommendation,
    closeRecommendation: () => setActiveRecommendation(null),
  };
}
