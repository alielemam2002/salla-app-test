import { Pencil, Save } from "lucide-react";
import { Button, Field, FormRow, Modal, TextInput } from "../ui/index.js";

const FORM_ID = "editor-edit-variant-form";

const FIELD_ROWS = [
  [
    { name: "sku", label: "رمز SKU الخاص بالمتغير", type: "text", dir: "ltr" },
    {
      name: "stock_quantity",
      label: "الكمية / المخزون",
      type: "number",
      min: "0",
    },
  ],
  [
    {
      name: "price",
      label: "السعر (ر.س)",
      type: "number",
      step: "any",
      min: "0",
    },
    {
      name: "sale_price",
      label: "سعر الخصم (ر.س)",
      type: "number",
      step: "any",
      min: "0",
      placeholder: "فارغ = لا يوجد خصم",
    },
    {
      name: "cost_price",
      label: "سعر التكلفة (ر.س)",
      type: "number",
      step: "any",
      min: "0",
    },
  ],
  [
    { name: "gtin", label: "رمز GTIN / الباركود", type: "text", dir: "ltr" },
    { name: "mpn", label: "رمز MPN", type: "text", dir: "ltr" },
    {
      name: "weight",
      label: "الوزن (كجم)",
      type: "number",
      step: "any",
      min: "0",
    },
  ],
];

/** Dialog to edit one variant's price, stock and codes. */
export default function EditVariantModal({
  variant,
  form,
  isSubmitting,
  onChange,
  onSubmit,
  onClose,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    // The dialog is rendered inside the editor <form>; don't trigger its save
    e.stopPropagation();
    onSubmit();
  };

  return (
    <Modal
      isOpen={Boolean(variant)}
      onClose={onClose}
      size="md"
      icon={Pencil}
      title={
        variant ? `تعديل المتغير: ${variant.name || `#${variant.id}`}` : ""
      }
      subtitle="تحديث السعر والمخزون والرمز الخاص بهذا المتغير عبر Salla Variants API."
      dismissible={!isSubmitting}
      footer={
        <>
          <Button onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            variant="primary"
            icon={Save}
            loading={isSubmitting}
          >
            حفظ المتغير
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={handleSubmit}
        className="modal-form"
        dir="rtl"
      >
        {FIELD_ROWS.map((row, i) => (
          <FormRow key={i} columns={row.length}>
            {row.map(({ name, label, ...inputProps }) => (
              <Field key={name} label={label}>
                <TextInput
                  {...inputProps}
                  value={form[name] ?? ""}
                  onChange={(e) => onChange(name, e.target.value)}
                />
              </Field>
            ))}
          </FormRow>
        ))}
      </form>
    </Modal>
  );
}
