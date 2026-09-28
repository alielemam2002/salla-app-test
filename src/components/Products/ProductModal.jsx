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
    { id: "basic", label: "Basic Information", icon: Package },
    { id: "pricing", label: "Pricing", icon: DollarSign },
    { id: "inventory", label: "Inventory", icon: Boxes },
    {
      id: "images",
      label: `Images (${values.images.length})`,
      icon: ImageIcon,
    },
    { id: "taxonomies", label: "Categories & Brand", icon: Layers },
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
      title={isEditing ? `Edit Product #${product.id}` : "Add New Product"}
      subtitle={
        isEditing
          ? "Update product details on Salla Admin API"
          : "Create and publish a new item in your Salla catalog"
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
            Cancel
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            variant="primary"
            loading={isSubmitting}
          >
            {isSubmitting
              ? "Saving..."
              : isEditing
                ? "Update Product"
                : "Create Product"}
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
          <Alert tone="error" title="Error">
            {generalError}
            {/scope/i.test(generalError) && (
              <div className="form-alert-hint">
                Make sure your app has the <code>products.read_write</code>{" "}
                scope enabled in the Salla Partners Portal.
              </div>
            )}
          </Alert>
        )}

        <FormSection ref={refs.basic} icon={Package} title="Basic Information">
          <BasicInfoFields {...fieldProps} isEditing={isEditing} />
        </FormSection>

        <FormSection ref={refs.pricing} icon={DollarSign} title="Pricing">
          <PricingFields {...fieldProps} />
        </FormSection>

        <FormSection ref={refs.inventory} icon={Boxes} title="Inventory">
          <InventoryFields {...fieldProps} />
        </FormSection>

        <FormSection ref={refs.images} icon={ImageIcon} title="Images">
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
          title="Categories & Brand"
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
