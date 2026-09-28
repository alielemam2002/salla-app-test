import { useState, useEffect, useRef } from "react";
import Button from "../forms/Button.jsx";
import {
  AlertCircle,
  X,
  Package,
  DollarSign,
  Image as ImageIcon,
  Layers,
  Plus,
  Trash2,
  Check,
  Boxes,
  Truck,
  Tag,
} from "lucide-react";

const PRODUCT_TYPES = [
  { value: "product", label: "Standard Product (Physical)" },
  { value: "service", label: "Service" },
  { value: "digital", label: "Digital Product" },
  { value: "codes", label: "Digital Cards / Codes" },
  { value: "food", label: "Food / Meals" },
  { value: "group_products", label: "Group / Bundle Products" },
  { value: "donating", label: "Donation" },
];

const PRODUCT_STATUSES = [
  { value: "sale", label: "Active (On Sale)" },
  { value: "out", label: "Out of Stock" },
  { value: "hidden", label: "Hidden" },
];

const WEIGHT_TYPES = [
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "lb", label: "lb" },
  { value: "oz", label: "oz" },
];

export default function ProductModal({
  isOpen,
  onClose,
  onSave,
  product = null,
  taxonomies = { categories: [], brands: [] },
}) {
  const isEditing = Boolean(product);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Refs for scrolling to sections
  const basicRef = useRef(null);
  const pricingRef = useRef(null);
  const inventoryRef = useRef(null);
  const imagesRef = useRef(null);
  const taxonomiesRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    product_type: "product",
    status: "sale",
    description: "",
    subtitle: "",
    price: "",
    sale_price: "",
    cost_price: "",
    sku: "",
    quantity: "",
    unlimited_quantity: false,
    maximum_quantity_per_order: "",
    require_shipping: true,
    weight: "",
    weight_type: "kg",
    brand_id: "",
    categories: [],
    manualCategoryIds: "",
    images: [],
  });

  const [imageUrlInput, setImageUrlInput] = useState("");

  // Initialize or reset form data when modal opens or product changes
  useEffect(() => {
    if (!isOpen) return;

    setGeneralError(null);
    setFieldErrors({});
    setImageUrlInput("");

    if (product) {
      const priceVal =
        typeof product.price === "object"
          ? (product.price?.amount ?? "")
          : (product.price ?? "");

      const salePriceVal =
        typeof product.sale_price === "object"
          ? (product.sale_price?.amount ?? "")
          : (product.sale_price ?? "");

      const costPriceVal =
        typeof product.cost_price === "object"
          ? (product.cost_price?.amount ?? "")
          : (product.cost_price ?? "");

      const initialImages = [];
      if (Array.isArray(product.images) && product.images.length > 0) {
        product.images.forEach((img, idx) => {
          const url =
            typeof img === "string" ? img : img.url || img.original || "";
          if (url) {
            initialImages.push({
              original: url,
              default: Boolean(img.default || idx === 0),
              alt: img.alt || "",
            });
          }
        });
      } else if (product.thumbnail || product.main_image) {
        const thumbUrl = product.thumbnail || product.main_image;
        initialImages.push({
          original: thumbUrl,
          default: true,
          alt: product.name || "",
        });
      }

      let catIds = [];
      if (Array.isArray(product.categories)) {
        catIds = product.categories
          .map((c) => (typeof c === "object" ? c.id : c))
          .filter(Boolean);
      }

      const brandIdVal = product.brand?.id ?? product.brand_id ?? "";

      setFormData({
        name: product.name || "",
        product_type: product.type || product.product_type || "product",
        status: product.status || "sale",
        description: product.description || "",
        subtitle: product.subtitle || "",
        price: priceVal !== "" ? String(priceVal) : "",
        sale_price: salePriceVal !== "" ? String(salePriceVal) : "",
        cost_price: costPriceVal !== "" ? String(costPriceVal) : "",
        sku: product.sku || "",
        quantity:
          product.quantity !== undefined && product.quantity !== null
            ? String(product.quantity)
            : "",
        unlimited_quantity: Boolean(product.unlimited_quantity),
        maximum_quantity_per_order:
          product.maximum_quantity_per_order !== undefined &&
          product.maximum_quantity_per_order !== null
            ? String(product.maximum_quantity_per_order)
            : "",
        require_shipping:
          product.require_shipping !== undefined
            ? Boolean(product.require_shipping)
            : true,
        weight: product.weight ? String(product.weight) : "",
        weight_type: product.weight_type || "kg",
        brand_id: brandIdVal ? String(brandIdVal) : "",
        categories: catIds,
        manualCategoryIds: catIds.join(", "),
        images: initialImages,
      });
    } else {
      setFormData({
        name: "",
        product_type: "product",
        status: "sale",
        description: "",
        subtitle: "",
        price: "",
        sale_price: "",
        cost_price: "",
        sku: "",
        quantity: "10",
        unlimited_quantity: false,
        maximum_quantity_per_order: "",
        require_shipping: true,
        weight: "",
        weight_type: "kg",
        brand_id: "",
        categories: [],
        manualCategoryIds: "",
        images: [],
      });
    }
  }, [isOpen, product]);

  if (!isOpen) return null;

  const scrollToSection = (ref) => {
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleAddImage = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;

    setFormData((prev) => {
      const isFirst = prev.images.length === 0;
      return {
        ...prev,
        images: [
          ...prev.images,
          { original: trimmed, default: isFirst, alt: prev.name || "" },
        ],
      };
    });
    setImageUrlInput("");
  };

  const handleRemoveImage = (index) => {
    setFormData((prev) => {
      const newImages = prev.images.filter((_, idx) => idx !== index);
      if (newImages.length > 0 && !newImages.some((img) => img.default)) {
        newImages[0].default = true;
      }
      return { ...prev, images: newImages };
    });
  };

  const handleSetDefaultImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.map((img, idx) => ({
        ...img,
        default: idx === index,
      })),
    }));
  };

  const handleToggleCategory = (catId) => {
    setFormData((prev) => {
      const numId = Number(catId);
      const exists = prev.categories.includes(numId);
      const nextCats = exists
        ? prev.categories.filter((id) => id !== numId)
        : [...prev.categories, numId];
      return {
        ...prev,
        categories: nextCats,
        manualCategoryIds: nextCats.join(", "),
      };
    });
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = "Product name is required.";
    }
    if (formData.price === "" || isNaN(Number(formData.price))) {
      errors.price = "A valid price is required.";
    } else if (Number(formData.price) < 0) {
      errors.price = "Price cannot be negative.";
    }

    if (formData.sale_price !== "" && !isNaN(Number(formData.sale_price))) {
      if (Number(formData.sale_price) < 0) {
        errors.sale_price = "Sale price cannot be negative.";
      }
    }

    if (
      !formData.unlimited_quantity &&
      formData.quantity !== "" &&
      (isNaN(Number(formData.quantity)) || Number(formData.quantity) < 0)
    ) {
      errors.quantity = "Quantity must be a non-negative number.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const manualIds = formData.manualCategoryIds
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s && !isNaN(Number(s)))
      .map(Number);

    const mergedCategories = Array.from(
      new Set([...formData.categories, ...manualIds]),
    );

    const payload = {
      name: formData.name.trim(),
      price: Number(formData.price),
      status: formData.status,
      description: formData.description.trim() || undefined,
      subtitle: formData.subtitle.trim() || undefined,
      sku: formData.sku.trim() || undefined,
      unlimited_quantity: formData.unlimited_quantity,
      require_shipping: formData.require_shipping,
    };

    if (!isEditing) {
      payload.product_type = formData.product_type || "product";
    }

    if (formData.unlimited_quantity) {
      payload.quantity = 0;
    } else if (formData.quantity !== "") {
      payload.quantity = Number(formData.quantity);
    }

    if (formData.sale_price !== "") {
      payload.sale_price = Number(formData.sale_price);
    }
    if (formData.cost_price !== "") {
      payload.cost_price = Number(formData.cost_price);
    }
    if (formData.maximum_quantity_per_order !== "") {
      payload.maximum_quantity_per_order = Number(
        formData.maximum_quantity_per_order,
      );
    }
    if (formData.weight !== "") {
      payload.weight = Number(formData.weight);
      payload.weight_type = formData.weight_type || "kg";
    }

    if (mergedCategories.length > 0) {
      payload.categories = mergedCategories;
    }

    if (formData.brand_id && !isNaN(Number(formData.brand_id))) {
      payload.brand_id = Number(formData.brand_id);
    }

    if (formData.images.length > 0) {
      payload.images = formData.images.map((img, idx) => ({
        original: img.original,
        default: Boolean(img.default),
        sort: idx + 1,
        alt: img.alt || formData.name || "",
      }));
    }

    try {
      const result = await onSave(payload, product?.id);
      if (!result?.success) {
        setIsSubmitting(false);
        setGeneralError(
          result?.error || "Salla rejected the product submission.",
        );
        if (result?.fields) {
          const mapped = {};
          Object.entries(result.fields).forEach(([k, v]) => {
            mapped[k] = Array.isArray(v) ? v.join(", ") : String(v);
          });
          setFieldErrors(mapped);
        }
      } else {
        setIsSubmitting(false);
        onClose();
      }
    } catch (err) {
      setIsSubmitting(false);
      setGeneralError(err.message || "An unexpected error occurred.");
    }
  };

  const categoriesList = taxonomies?.categories || [];
  const brandsList = taxonomies?.brands || [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content modal-content--lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge">
              <Package size={20} />
            </div>
            <div>
              <h3 id="product-form-title" className="modal-title">
                {isEditing ? `Edit Product #${product.id}` : "Add New Product"}
              </h3>
              <span className="modal-subtitle">
                {isEditing
                  ? "Update product details on Salla Admin API"
                  : "Create and publish a new item in your Salla catalog"}
              </span>
            </div>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Section Navigation Pills */}
        <div className="modal-tabs">
          <button
            type="button"
            className="modal-tab-btn"
            onClick={() => scrollToSection(basicRef)}
          >
            <Package size={14} /> Basic Information
          </button>
          <button
            type="button"
            className="modal-tab-btn"
            onClick={() => scrollToSection(pricingRef)}
          >
            <DollarSign size={14} /> Pricing
          </button>
          <button
            type="button"
            className="modal-tab-btn"
            onClick={() => scrollToSection(inventoryRef)}
          >
            <Boxes size={14} /> Inventory
          </button>
          <button
            type="button"
            className="modal-tab-btn"
            onClick={() => scrollToSection(imagesRef)}
          >
            <ImageIcon size={14} /> Images ({formData.images.length})
          </button>
          <button
            type="button"
            className="modal-tab-btn"
            onClick={() => scrollToSection(taxonomiesRef)}
          >
            <Layers size={14} /> Categories & Brand
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body">
            {generalError && (
              <div className="form-alert form-alert--error">
                <AlertCircle size={18} />
                <div className="form-alert-content">
                  <strong>Error: </strong>
                  <span>{generalError}</span>
                  {/scope/i.test(generalError) && (
                    <div className="form-alert-hint">
                      Make sure your app has the{" "}
                      <code>products.read_write</code> scope enabled in the
                      Salla Partners Portal.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 1: BASIC INFORMATION */}
            <div ref={basicRef} className="form-section">
              <div className="section-title">
                <Package size={16} /> Basic Information
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="product-name">
                  Product Name <span className="form-required">*</span>
                </label>
                <input
                  id="product-name"
                  type="text"
                  className={`form-input ${fieldErrors.name ? "form-input--error" : ""}`}
                  placeholder="e.g. Classic Cotton T-Shirt"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  disabled={isSubmitting}
                />
                {fieldErrors.name && (
                  <span className="form-error-msg">{fieldErrors.name}</span>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="product-type">
                    Product Type{" "}
                    {!isEditing && <span className="form-required">*</span>}
                  </label>
                  <select
                    id="product-type"
                    className="form-select"
                    value={formData.product_type}
                    onChange={(e) =>
                      handleInputChange("product_type", e.target.value)
                    }
                    disabled={isEditing || isSubmitting}
                  >
                    {PRODUCT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {isEditing && (
                    <span className="form-hint">
                      Product type cannot be changed after creation per Salla
                      API rules.
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="product-status">
                    Status
                  </label>
                  <select
                    id="product-status"
                    className="form-select"
                    value={formData.status}
                    onChange={(e) =>
                      handleInputChange("status", e.target.value)
                    }
                    disabled={isSubmitting}
                  >
                    {PRODUCT_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="product-subtitle">
                  Subtitle / Short Tagline
                </label>
                <input
                  id="product-subtitle"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Premium Summer Collection 2026"
                  value={formData.subtitle}
                  onChange={(e) =>
                    handleInputChange("subtitle", e.target.value)
                  }
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="product-description">
                  Description
                </label>
                <textarea
                  id="product-description"
                  className="form-textarea"
                  rows={3}
                  placeholder="Detailed information about the product..."
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="form-divider" />

            {/* SECTION 2: PRICING */}
            <div ref={pricingRef} className="form-section">
              <div className="section-title">
                <DollarSign size={16} /> Pricing
              </div>

              <div className="form-row form-row--3">
                <div className="form-group">
                  <label className="form-label" htmlFor="product-price">
                    Regular Price (SAR) <span className="form-required">*</span>
                  </label>
                  <input
                    id="product-price"
                    type="number"
                    step="any"
                    min="0"
                    className={`form-input ${fieldErrors.price ? "form-input--error" : ""}`}
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => handleInputChange("price", e.target.value)}
                    disabled={isSubmitting}
                  />
                  {fieldErrors.price && (
                    <span className="form-error-msg">{fieldErrors.price}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="product-sale-price">
                    Sale Price (SAR)
                  </label>
                  <input
                    id="product-sale-price"
                    type="number"
                    step="any"
                    min="0"
                    className={`form-input ${fieldErrors.sale_price ? "form-input--error" : ""}`}
                    placeholder="Optional discounted price"
                    value={formData.sale_price}
                    onChange={(e) =>
                      handleInputChange("sale_price", e.target.value)
                    }
                    disabled={isSubmitting}
                  />
                  {fieldErrors.sale_price && (
                    <span className="form-error-msg">
                      {fieldErrors.sale_price}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="product-cost-price">
                    Cost Price (SAR)
                  </label>
                  <input
                    id="product-cost-price"
                    type="number"
                    step="any"
                    min="0"
                    className="form-input"
                    placeholder="Wholesale/cost"
                    value={formData.cost_price}
                    onChange={(e) =>
                      handleInputChange("cost_price", e.target.value)
                    }
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            <div className="form-divider" />

            {/* SECTION 3: INVENTORY */}
            <div ref={inventoryRef} className="form-section">
              <div className="section-title">
                <Boxes size={16} /> Inventory
              </div>

              <div className="form-row form-row--3">
                <div className="form-group">
                  <label className="form-label" htmlFor="product-sku">
                    SKU (Stock Keeping Unit)
                  </label>
                  <input
                    id="product-sku"
                    type="text"
                    className="form-input font-mono"
                    placeholder="e.g. TSH-BLU-001"
                    value={formData.sku}
                    onChange={(e) => handleInputChange("sku", e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="product-quantity">
                    Stock Quantity
                  </label>
                  <input
                    id="product-quantity"
                    type="number"
                    min="0"
                    className={`form-input ${fieldErrors.quantity ? "form-input--error" : ""}`}
                    placeholder="0"
                    value={formData.unlimited_quantity ? "" : formData.quantity}
                    onChange={(e) =>
                      handleInputChange("quantity", e.target.value)
                    }
                    disabled={formData.unlimited_quantity || isSubmitting}
                  />
                  {fieldErrors.quantity && (
                    <span className="form-error-msg">
                      {fieldErrors.quantity}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="product-max-qty">
                    Max Qty / Order
                  </label>
                  <input
                    id="product-max-qty"
                    type="number"
                    min="1"
                    className="form-input"
                    placeholder="No limit"
                    value={formData.maximum_quantity_per_order}
                    onChange={(e) =>
                      handleInputChange(
                        "maximum_quantity_per_order",
                        e.target.value,
                      )
                    }
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.unlimited_quantity}
                    onChange={(e) =>
                      handleInputChange("unlimited_quantity", e.target.checked)
                    }
                    disabled={isSubmitting}
                  />
                  <span>Unlimited Quantity (Never runs out of stock)</span>
                </label>
              </div>
            </div>

            <div className="form-divider" />

            {/* SECTION 4: IMAGES */}
            <div ref={imagesRef} className="form-section">
              <div className="section-title">
                <ImageIcon size={16} /> Images
              </div>

              <div className="form-group">
                <label className="form-label">Add Image via Direct URL</label>
                <div className="image-input-group">
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://example.com/product-image.jpg"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddImage();
                      }
                    }}
                    disabled={isSubmitting}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleAddImage}
                    disabled={!imageUrlInput.trim() || isSubmitting}
                  >
                    <Plus size={16} /> Add Image
                  </Button>
                </div>
                <span className="form-hint">
                  Enter direct public image URLs (JPEG, PNG, WebP). Salla
                  requires at least one image to set product status to Active.
                </span>
              </div>

              <div className="product-images-grid">
                {formData.images.length === 0 ? (
                  <div className="product-images-empty">
                    <ImageIcon size={32} />
                    <p>No images added yet.</p>
                    <span>Add image URLs above.</span>
                  </div>
                ) : (
                  formData.images.map((img, idx) => (
                    <div
                      key={idx}
                      className={`product-image-card ${img.default ? "product-image-card--default" : ""}`}
                    >
                      <img
                        src={img.original}
                        alt={img.alt || `Product image ${idx + 1}`}
                        className="product-image-preview"
                        onError={(e) => {
                          e.currentTarget.src =
                            "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%2280%22%20height%3D%2280%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20fill%3D%22%23444%22%20width%3D%2280%22%20height%3D%2280%22%2F%3E%3Ctext%20fill%3D%22%23aaa%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%20font-size%3D%2210%22%3EInvalid%20Img%3C%2Ftext%3E%3C%2Fsvg%3E";
                        }}
                      />
                      <div className="product-image-overlay">
                        {img.default ? (
                          <span className="product-image-badge">
                            <Check size={12} /> Main
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="product-image-btn"
                            onClick={() => handleSetDefaultImage(idx)}
                            title="Set as main thumbnail"
                          >
                            Make Main
                          </button>
                        )}
                        <button
                          type="button"
                          className="product-image-btn product-image-btn--delete"
                          onClick={() => handleRemoveImage(idx)}
                          title="Remove image"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="form-divider" />

            {/* SECTION 5: CATEGORIES & BRAND */}
            <div ref={taxonomiesRef} className="form-section">
              <div className="section-title">
                <Layers size={16} /> Categories & Brand
              </div>

              {/* Brand Selector */}
              <div className="form-group">
                <label className="form-label" htmlFor="product-brand">
                  Brand
                </label>
                {brandsList.length > 0 ? (
                  <select
                    id="product-brand"
                    className="form-select"
                    value={formData.brand_id}
                    onChange={(e) =>
                      handleInputChange("brand_id", e.target.value)
                    }
                    disabled={isSubmitting}
                  >
                    <option value="">-- None (No Brand) --</option>
                    {brandsList.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name} (#{brand.id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="product-brand"
                    type="number"
                    className="form-input"
                    placeholder="Enter Brand ID (optional)"
                    value={formData.brand_id}
                    onChange={(e) =>
                      handleInputChange("brand_id", e.target.value)
                    }
                    disabled={isSubmitting}
                  />
                )}
              </div>

              {/* Categories */}
              <div className="form-group">
                <label className="form-label">Categories</label>
                {categoriesList.length > 0 ? (
                  <div className="categories-selection-list">
                    {categoriesList.map((cat) => {
                      const isChecked = formData.categories.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          className={`category-item-checkbox ${isChecked ? "active" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleCategory(cat.id)}
                            disabled={isSubmitting}
                          />
                          <span>{cat.name}</span>
                          <span className="category-item-id">#{cat.id}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}

                <div className="manual-categories-input">
                  <label className="form-label" htmlFor="manual-category-ids">
                    Category IDs (comma-separated)
                  </label>
                  <input
                    id="manual-category-ids"
                    type="text"
                    className="form-input font-mono"
                    placeholder="e.g. 10293847, 59283741"
                    value={formData.manualCategoryIds}
                    onChange={(e) =>
                      handleInputChange("manualCategoryIds", e.target.value)
                    }
                    disabled={isSubmitting}
                  />
                  <span className="form-hint">
                    Enter Salla Category IDs directly.
                  </span>
                </div>
              </div>

              {/* Shipping & Physical Details */}
              <div className="form-group">
                <label className="form-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.require_shipping}
                    onChange={(e) =>
                      handleInputChange("require_shipping", e.target.checked)
                    }
                    disabled={isSubmitting}
                  />
                  <span>Requires Shipping / Physical Delivery</span>
                </label>
              </div>

              {formData.require_shipping && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="product-weight">
                      Weight
                    </label>
                    <input
                      id="product-weight"
                      type="number"
                      step="any"
                      min="0"
                      className="form-input"
                      placeholder="0.5"
                      value={formData.weight}
                      onChange={(e) =>
                        handleInputChange("weight", e.target.value)
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="product-weight-unit">
                      Weight Unit
                    </label>
                    <select
                      id="product-weight-unit"
                      className="form-select"
                      value={formData.weight_type}
                      onChange={(e) =>
                        handleInputChange("weight_type", e.target.value)
                      }
                      disabled={isSubmitting}
                    >
                      {WEIGHT_TYPES.map((w) => (
                        <option key={w.value} value={w.value}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <Button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : isEditing
                  ? "Update Product"
                  : "Create Product"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
