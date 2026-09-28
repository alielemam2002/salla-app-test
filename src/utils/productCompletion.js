/**
 * Product Completion Score System
 *
 * Evaluates the completeness of Salla product data across 5 core dimensions:
 * - Basic Information (20%)
 * - Appearance (15%)
 * - SEO (11%)
 * - Pricing & Inventory (5%)
 * - Options & Variants (5%)
 *
 * Fully dynamic and reactive to form updates without requiring page reloads.
 */

export const COMPLETION_RULES = {
  basicInfo: {
    id: "basicInfo",
    label: "المعلومات الأساسية",
    labelEn: "Basic Information",
    weight: 20,
    fields: {
      name: {
        label: "اسم المنتج",
        fieldId: "field-name",
        weight: 8.6,
        section: "basicInfo",
        check: (data) =>
          Boolean(data?.name && String(data.name).trim().length > 0),
      },
      description: {
        label: "وصف المنتج",
        fieldId: "field-description",
        weight: 6.65,
        section: "basicInfo",
        check: (data) => {
          if (!data?.description) return false;
          const plain = String(data.description)
            .replace(/<[^>]*>/g, "")
            .trim();
          return plain.length > 0;
        },
      },
      category: {
        label: "تصنيف المنتج",
        fieldId: "field-categories",
        weight: 3,
        section: "basicInfo",
        check: (data) => {
          if (Array.isArray(data?.categories) && data.categories.length > 0) {
            return true;
          }
          return (
            data?.category_id !== undefined &&
            data?.category_id !== null &&
            data?.category_id !== ""
          );
        },
      },
      brand: {
        label: "العلامة التجارية",
        fieldId: "field-brand_id",
        weight: 2,
        section: "basicInfo",
        check: (data) =>
          data?.brand_id !== undefined &&
          data?.brand_id !== null &&
          data?.brand_id !== "" &&
          Number(data.brand_id) > 0,
      },
    },
  },

  appearance: {
    id: "appearance",
    label: "المظهر",
    labelEn: "Appearance",
    weight: 15,
    fields: {
      mainImage: {
        label: "الصورة الأساسية",
        fieldId: "field-images",
        weight: 5,
        section: "appearance",
        check: (data) => {
          if (data?.mainImage || data?.main_image || data?.thumbnail) return true;
          if (Array.isArray(data?.images) && data.images.length > 0) return true;
          return false;
        },
      },
      additionalImages: {
        label: "صور إضافية للمنتج",
        fieldId: "field-images-additional",
        weight: 5,
        section: "appearance",
        check: (data) => {
          return Array.isArray(data?.images) && data.images.length >= 2;
        },
      },
      promotionTitle: {
        label: "عنوان ترويجي للمنتج",
        fieldId: "field-promotion_title",
        weight: 2,
        section: "appearance",
        check: (data) =>
          Boolean(
            data?.promotion_title &&
              String(data.promotion_title).trim().length > 0,
          ),
      },
      subtitle: {
        label: "عنوان فرعي للمنتج",
        fieldId: "field-subtitle",
        weight: 2,
        section: "appearance",
        check: (data) =>
          Boolean(data?.subtitle && String(data.subtitle).trim().length > 0),
      },
    },
  },

  seo: {
    id: "seo",
    label: "محركات البحث SEO",
    labelEn: "Search Engine Optimization (SEO)",
    weight: 11,
    fields: {
      tags: {
        label: "وسوم المنتج (Tags)",
        fieldId: "field-tags",
        weight: 4,
        section: "seo",
        check: (data) => {
          if (Array.isArray(data?.tags)) return data.tags.length > 0;
          if (typeof data?.tags === "string") return data.tags.trim().length > 0;
          return false;
        },
      },
      seoTitle: {
        label: "عنوان SEO (Title)",
        fieldId: "field-metadata_title",
        weight: 3,
        section: "seo",
        check: (data) =>
          Boolean(
            data?.metadata_title &&
              String(data.metadata_title).trim().length > 0,
          ),
      },
      seoDescription: {
        label: "وصف SEO (Description)",
        fieldId: "field-metadata_description",
        weight: 3,
        section: "seo",
        check: (data) =>
          Boolean(
            data?.metadata_description &&
              String(data.metadata_description).trim().length > 0,
          ),
      },
      url: {
        label: "رابط SEO مخصص (Slug)",
        fieldId: "field-metadata_url",
        weight: 1,
        section: "seo",
        check: (data) =>
          Boolean(
            data?.metadata_url && String(data.metadata_url).trim().length > 0,
          ),
      },
    },
  },

  pricingInventory: {
    id: "pricingInventory",
    label: "السعر والمخزون",
    labelEn: "Pricing & Inventory",
    weight: 5,
    fields: {
      price: {
        label: "السعر الأساسي",
        fieldId: "field-price",
        weight: 3,
        section: "pricingInventory",
        check: (data) => {
          const val =
            typeof data?.price === "object" ? data.price?.amount : data?.price;
          return (
            val !== undefined &&
            val !== null &&
            val !== "" &&
            !isNaN(Number(val)) &&
            Number(val) > 0
          );
        },
      },
      costPrice: {
        label: "سعر التكلفة",
        fieldId: "field-cost_price",
        weight: 1,
        section: "pricingInventory",
        check: (data) => {
          const val =
            typeof data?.cost_price === "object"
              ? data.cost_price?.amount
              : data?.cost_price;
          return (
            val !== undefined &&
            val !== null &&
            val !== "" &&
            !isNaN(Number(val)) &&
            Number(val) > 0
          );
        },
      },
      quantity: {
        label: "الكمية والمخزون",
        fieldId: "field-quantity",
        weight: 1,
        section: "pricingInventory",
        check: (data) => {
          if (data?.unlimited_quantity) return true;
          return (
            data?.quantity !== undefined &&
            data?.quantity !== null &&
            data?.quantity !== "" &&
            !isNaN(Number(data.quantity)) &&
            Number(data.quantity) >= 0
          );
        },
      },
      sku: {
        label: "رمز المنتج (SKU)",
        fieldId: "field-sku",
        weight: 1,
        section: "pricingInventory",
        check: (data) =>
          Boolean(data?.sku && String(data.sku).trim().length > 0),
      },
      gtin: {
        label: "رمز الباركود الدولي (GTIN)",
        fieldId: "field-gtin",
        weight: 1,
        section: "pricingInventory",
        check: (data) => {
          const gtin = data?.gtin || data?.barcode;
          return Boolean(gtin && String(gtin).trim().length > 0);
        },
      },
      mpn: {
        label: "رقم الشركة المصنعة (MPN)",
        fieldId: "field-mpn",
        weight: 1,
        section: "pricingInventory",
        check: (data) =>
          Boolean(data?.mpn && String(data.mpn).trim().length > 0),
      },
    },
  },

  variants: {
    id: "variants",
    label: "الخيارات والمتغيرات",
    labelEn: "Options & Variants",
    weight: 5,
    fields: {
      hasOptions: {
        label: "خيارات أو متغيرات المنتج",
        fieldId: "field-options-variants",
        weight: 5,
        section: "variants",
        check: (data) => {
          const hasOpts =
            Array.isArray(data?.options) && data.options.length > 0;
          const hasVars =
            Array.isArray(data?.variants) && data.variants.length > 0;
          const hasSkus = Array.isArray(data?.skus) && data.skus.length > 0;
          return hasOpts || hasVars || hasSkus;
        },
      },
    },
  },
};

/**
 * Calculates the complete Product Completion Score and itemized breakdown.
 *
 * @param {object} productData - Current product object (or form values)
 * @param {object} [customRules] - Optional override of rules
 * @returns {object} Calculated score metrics
 */
export function calculateCompletionScore(productData = {}, customRules = COMPLETION_RULES) {
  let totalEarnedNormalized = 0;
  const sectionsBreakdown = {};
  const remainingItems = [];
  const completedItems = [];

  // Section weights don't have to add up to 100, so every number we show is
  // converted to "points of the final 0–100% score".
  const totalMaxWeight = Object.values(customRules).reduce(
    (sum, section) => sum + section.weight,
    0,
  );
  const toPercent = (weight) =>
    totalMaxWeight > 0 ? (weight / totalMaxWeight) * 100 : 0;
  const round1 = (n) => Math.round(n * 10) / 10;

  Object.entries(customRules).forEach(([sectionKey, section]) => {
    const sectionFieldWeightSum = Object.values(section.fields).reduce(
      (sum, f) => sum + f.weight,
      0,
    );
    let sectionEarnedWeight = 0;
    const fieldsStatus = {};

    Object.entries(section.fields).forEach(([fieldKey, fieldDef]) => {
      const isCompleted = fieldDef.check(productData);
      // Real contribution of this field to the final score
      const gain =
        sectionFieldWeightSum > 0
          ? toPercent((fieldDef.weight / sectionFieldWeightSum) * section.weight)
          : 0;
      fieldsStatus[fieldKey] = isCompleted;

      if (isCompleted) {
        sectionEarnedWeight += fieldDef.weight;
        completedItems.push({
          key: fieldKey,
          label: fieldDef.label,
          fieldId: fieldDef.fieldId,
          sectionId: section.id,
          sectionLabel: section.label,
          weight: fieldDef.weight,
        });
      } else {
        remainingItems.push({
          key: fieldKey,
          label: `إضافة ${fieldDef.label}`,
          fieldId: fieldDef.fieldId,
          sectionId: section.id,
          sectionLabel: section.label,
          weightGain: `+${round1(gain)}%`,
          gain,
          weight: fieldDef.weight,
        });
      }
    });

    // Fraction earned within this section (0 to 1)
    const sectionRatio =
      sectionFieldWeightSum > 0 ? sectionEarnedWeight / sectionFieldWeightSum : 0;

    // Actual score points for this section based on its target weight
    const sectionScore = Number((sectionRatio * section.weight).toFixed(2));
    totalEarnedNormalized += sectionScore;

    const isFullyComplete = sectionRatio >= 0.999;

    sectionsBreakdown[sectionKey] = {
      id: section.id,
      label: section.label,
      labelEn: section.labelEn,
      targetWeight: round1(toPercent(section.weight)),
      currentScore: round1(toPercent(sectionScore)),
      percentage: Math.round(sectionRatio * 100),
      isComplete: isFullyComplete,
      fields: fieldsStatus,
    };
  });

  // Scale total score to a clean 0-100% integer
  const rawPercentage = toPercent(totalEarnedNormalized);
  const clampPercent = (n) => Math.min(100, Math.max(0, Math.round(n)));
  const finalPercentage = clampPercent(rawPercentage);

  // Score the product would reach after completing each missing item
  remainingItems.forEach((item) => {
    item.expectedScore = clampPercent(rawPercentage + item.gain);
  });

  return {
    score: finalPercentage,
    sections: sectionsBreakdown,
    remainingItems,
    completedItems,
    isComplete: finalPercentage === 100,
  };
}
