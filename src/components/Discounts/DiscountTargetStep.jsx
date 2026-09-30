import { CheckSquare, FolderTree, Store } from "lucide-react";
import { Field, Select, SectionHeader, TextInput, cx } from "../ui/index.js";

/** Step 1: pick selected products, a category, or the whole store. */
export default function DiscountTargetStep({
  target,
  onTargetChange,
  selectedCount,
  categories,
  selectedCategoryId,
  onCategoryChange,
  disabled,
}) {
  const options = [
    {
      value: "selected",
      title: "المنتجات المحددة",
      icon: CheckSquare,
      desc:
        selectedCount > 0
          ? `${selectedCount} منتج محدد في الجدول`
          : "لا توجد منتجات محددة حاليًا",
      disabled: selectedCount === 0,
    },
    {
      value: "category",
      title: "التصنيف",
      icon: FolderTree,
      desc: "طبّق على كل منتجات تصنيف معيّن",
    },
    {
      value: "all",
      title: "كل المنتجات",
      icon: Store,
      desc: "طبّق على كل منتجات المتجر",
    },
  ];

  return (
    <section className="form-section">
      <SectionHeader title="1. اختر المنتجات المستهدفة" />
      <div
        className="target-cards-grid"
        role="radiogroup"
        aria-label="المنتجات المستهدفة"
      >
        {options.map((opt) => (
          <label
            key={opt.value}
            className={cx(
              "target-card",
              target === opt.value && "active",
              opt.disabled && "disabled",
            )}
          >
            <input
              type="radio"
              name="discount-target"
              value={opt.value}
              checked={target === opt.value}
              disabled={opt.disabled || disabled}
              onChange={() => onTargetChange(opt.value)}
            />
            <span className="target-card-icon" aria-hidden="true">
              <opt.icon size={16} />
            </span>
            <div className="target-card-content">
              <div className="target-card-title">{opt.title}</div>
              <div className="target-card-desc">{opt.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {target === "category" && (
        <Field label="اختر التصنيف" htmlFor="discount-category">
          {categories.length > 0 ? (
            <Select
              value={selectedCategoryId}
              onChange={(e) => onCategoryChange(e.target.value)}
              disabled={disabled}
              options={categories.map((c) => ({
                value: c.id,
                label: `${c.name} (#${c.id})`,
              }))}
            />
          ) : (
            <TextInput
              type="number"
              placeholder="أدخل معرّف التصنيف"
              value={selectedCategoryId}
              onChange={(e) => onCategoryChange(e.target.value)}
              disabled={disabled}
            />
          )}
        </Field>
      )}
    </section>
  );
}
