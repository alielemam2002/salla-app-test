import { useRef } from "react";
import {
  Boxes,
  DollarSign,
  Image as ImageIcon,
  Layers,
  Package,
} from "lucide-react";
import { Alert, Button, Modal } from "../ui/index.js";
import { useProductForm } from "../../hooks/products/useProductForm.js";
import FormSection from "./form/FormSection.jsx";
import ProductFormNav from "./form/ProductFormNav.jsx";
import FullEditorBanner from "./form/FullEditorBanner.jsx";
import BasicInfoFields from "./form/BasicInfoFields.jsx";
import PricingFields from "./form/PricingFields.jsx";
import InventoryFields from "./form/InventoryFields.jsx";
import ImagesField from "./form/ImagesField.jsx";
import TaxonomyFields from "./form/TaxonomyFields.jsx";

const FORM_ID = "product-form";

/** Add / Edit product dialog. All form logic lives in useProductForm. */
export default function ProductModal({
  isOpen,
  onClose,
  onSave,
  product = null,
  taxonomies = { categories: [], brands: [] },
  onOpenFullEditor,
}) {
  const form = useProductForm({ isOpen, product, onSave, onClose });
  const {
    isEditing,
    values,
    fieldErrors,
    generalError,
    isSubmitting,
    setField,
  } = form;

  const refs = {
    basic: useRef(null),
    pricing: useRef(null),
    inventory: useRef(null),
    images: useRef(null),
    taxonomies: useRef(null),
  };
  const scrollTo = (key) =>
    refs[key].current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const navItems = [
    { id: "basic", label: "المعلومات الأساسية", icon: Package },
    { id: "pricing", label: "الأسعار", icon: DollarSign },
    { id: "inventory", label: "المخزون", icon: Boxes },
    {
      id: "images",
      label: `الصور (${values.images.length})`,
      icon: ImageIcon,
    },
    { id: "taxonomies", label: "التصنيفات والعلامة التجارية", icon: Layers },
  ].map((item) => ({ ...item, onClick: () => scrollTo(item.id) }));

  const fieldProps = {
    values,
    errors: fieldErrors,
    setField,
    disabled: isSubmitting,
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      icon={Package}
      title={isEditing ? `تعديل المنتج #${product.id}` : "إضافة منتج"}
      subtitle={
        isEditing
          ? "عدّل بيانات المنتج وسيتم تحديثها في متجرك على سلة"
          : "أضف منتجًا جديدًا إلى كتالوج متجرك في سلة"
      }
      dismissible={!isSubmitting}
      headerExtra={
        <>
          <ProductFormNav items={navItems} />
          {isEditing && onOpenFullEditor && (
            <FullEditorBanner
              onOpen={() => {
                onClose();
                onOpenFullEditor(product);
              }}
            />
          )}
        </>
      }
      footer={
        <>
          <Button onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            variant="primary"
            loading={isSubmitting}
          >
            {isSubmitting
              ? "جارٍ الحفظ…"
              : isEditing
                ? "حفظ التعديلات"
                : "إضافة المنتج"}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit}
        className="product-form"
        noValidate
      >
        {generalError && (
          <Alert tone="error" title="تعذّر الحفظ">
            {generalError}
            {/scope/i.test(generalError) && (
              <div className="form-alert-hint">
                تأكد من تفعيل صلاحية <code dir="ltr">products.read_write</code>{" "}
                لتطبيقك في بوابة شركاء سلة.
              </div>
            )}
          </Alert>
        )}

        <FormSection ref={refs.basic} icon={Package} title="المعلومات الأساسية">
          <BasicInfoFields {...fieldProps} isEditing={isEditing} />
        </FormSection>

        <FormSection ref={refs.pricing} icon={DollarSign} title="الأسعار">
          <PricingFields {...fieldProps} />
        </FormSection>

        <FormSection ref={refs.inventory} icon={Boxes} title="المخزون">
          <InventoryFields {...fieldProps} />
        </FormSection>

        <FormSection ref={refs.images} icon={ImageIcon} title="الصور">
          <ImagesField
            images={values.images}
            urlInput={form.images.urlInput}
            setUrlInput={form.images.setUrlInput}
            onAdd={form.images.add}
            onRemove={form.images.remove}
            onSetMain={form.images.setMain}
            disabled={isSubmitting}
          />
        </FormSection>

        <FormSection
          ref={refs.taxonomies}
          icon={Layers}
          title="التصنيفات والعلامة التجارية"
        >
          <TaxonomyFields
            values={values}
            setField={setField}
            toggleCategory={form.toggleCategory}
            categories={taxonomies?.categories || []}
            brands={taxonomies?.brands || []}
            disabled={isSubmitting}
          />
        </FormSection>
      </form>
    </Modal>
  );
}
