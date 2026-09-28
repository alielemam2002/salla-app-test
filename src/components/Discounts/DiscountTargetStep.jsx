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
      title: "Selected Products",
      icon: CheckSquare,
      desc:
        selectedCount > 0
          ? `${selectedCount} items checked in table`
          : "No products currently selected",
      disabled: selectedCount === 0,
    },
    {
      value: "category",
      title: "Category",
      icon: FolderTree,
      desc: "Apply to all products in a specific category",
    },
    {
      value: "all",
      title: "All Products",
      icon: Store,
      desc: "Apply storewide across all catalog items",
    },
  ];

  return (
    <section className="form-section">
      <SectionHeader title="1. Choose Target Products" />
      <div
        className="target-cards-grid"
        role="radiogroup"
        aria-label="Target products"
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
        <Field label="Select Category" htmlFor="discount-category">
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
              placeholder="Enter Category ID"
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
