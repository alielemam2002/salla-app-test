import { Check, Layers } from "lucide-react";
import {
  Button,
  Field,
  Modal,
  Select,
  Textarea,
  TextInput,
} from "../ui/index.js";

const FORM_ID = "editor-add-option-form";
const TYPE_OPTIONS = [
  { value: "text", label: "نص (Text)" },
  { value: "color", label: "لون (Color)" },
  { value: "image", label: "صورة (Image)" },
];

/** Dialog to create a product option with its values. */
export default function AddOptionModal({
  isOpen,
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
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      icon={Layers}
      title="إضافة خيار جديد للمنتج"
      subtitle="أنشئ خاصية مثل المقاس أو اللون مع خياراتها المتعددة."
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
            icon={Check}
            loading={isSubmitting}
          >
            إضافة الخيار
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
        <Field label="اسم الخيار" required>
          <TextInput
            type="text"
            placeholder="مثال: المقاس، اللون، السعة"
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            required
          />
        </Field>

        <Field label="نوع العرض في المتجر">
          <Select
            options={TYPE_OPTIONS}
            value={form.type}
            onChange={(e) => onChange("type", e.target.value)}
          />
        </Field>

        <Field
          label="قيم الخيار (افصل بينها بفواصل أو سطور)"
          required
          hint="سيتم إنشاء هذه الخيارات وإتاحتها لإنشاء المتغيرات تلقائيًا."
        >
          <Textarea
            rows={3}
            placeholder="مثال: صغير, متوسط, كبير, كبير جداً"
            value={form.valuesInput}
            onChange={(e) => onChange("valuesInput", e.target.value)}
            required
          />
        </Field>
      </form>
    </Modal>
  );
}
