import { useId, useState } from "react";
import {
  Ticket,
  Eye,
  Megaphone,
  LayoutGrid,
  Code,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import {
  Alert,
  Button,
  Field,
  FormRow,
  Modal,
  Select,
  Switch,
  TextInput,
} from "../ui/index.js";
import { useCouponForm } from "../../hooks/coupons/useCouponForm.js";
import { FIELD_LABELS } from "../../utils/coupons/couponErrors.js";
import CouponScope from "./CouponScope.jsx";
import CouponStorePreview from "./CouponStorePreview.jsx";
import { generateCouponTwigSnippet } from "../../utils/coupons/couponEmbedSnippet.js";
import { generateSmartCouponTexts } from "../../utils/coupons/displaySettingsStorage.js";

const TYPE_OPTIONS = [
  { value: "percentage", label: "Percentage (%)" },
  { value: "fixed", label: "Fixed amount" },
];

/**
 * Create / edit a storewide coupon with storefront placement options:
 * - Top Announcement Bar (الشريط الإعلاني أعلى المتجر - الصورة 2)
 * - In-page card placements (صفحة المنتج، قائمة المنتجات، والسلة - الصورة 1)
 * - Live interactive preview & Twig embed generator
 */
export default function CouponFormModal({
  isOpen,
  coupon,
  currency = "SAR",
  saving,
  serverError,
  onClose,
  onSubmit,
}) {
  const formId = useId();
  const isEdit = Boolean(coupon);
  const [activeTab, setActiveTab] = useState("settings"); // 'settings' | 'display'
  const [showSnippet, setShowSnippet] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const { form, errors, setField, submit } = useCouponForm({ coupon, isOpen });

  const fieldError = (name) => errors[name] || serverError?.fieldErrors?.[name];
  // Salla field errors for inputs this form doesn't show still need a place.
  const otherServerFields = Object.entries(
    serverError?.fieldErrors || {},
  ).filter(([name]) => !(name in form));

  const text = (name, props = {}) => (
    <TextInput
      value={form[name]}
      onChange={(e) => setField(name, e.target.value)}
      invalid={Boolean(fieldError(name))}
      {...props}
    />
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    submit(onSubmit);
  };

  const handleAutoFillTexts = () => {
    const smart = generateSmartCouponTexts({
      code: form.code,
      amount: form.amount,
      type: form.type,
    });
    setField("card_headline_text", smart.headline);
    setField("announcement_text", smart.announcement);
  };

  const handleCopySnippet = () => {
    const snippet = generateCouponTwigSnippet(form.code, form);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(snippet);
    }
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dismissible={!saving}
      icon={Ticket}
      title={isEdit ? `Edit coupon ${coupon.code}` : "Create Coupon"}
      subtitle="Storewide discount code"
      size="lg"
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            loading={saving}
          >
            {isEdit ? "Save changes" : "Create Coupon"}
          </Button>
        </>
      }
    >
      {/* Segmented Top Tabs: Settings vs Store Display */}
      <div className="coupon-form-segmented-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "settings"}
          className={`coupon-form-tab-btn ${activeTab === "settings" ? "is-active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          <Ticket size={15} />
          <span>قواعد وبيانات الكوبون</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "display"}
          className={`coupon-form-tab-btn ${activeTab === "display" ? "is-active" : ""}`}
          onClick={() => setActiveTab("display")}
        >
          <Eye size={15} />
          <span>ظهور الكوبون بالمتجر (الشريط والصفحات)</span>
        </button>
      </div>

      <form
        id={formId}
        className="coupon-form"
        onSubmit={handleSubmit}
        noValidate
      >
        {serverError && (
          <Alert tone="error" title={serverError.title}>
            <p>Salla rejected the request: {serverError.reason}</p>
            {otherServerFields.length > 0 && (
              <ul className="coupon-form-server-fields">
                {otherServerFields.map(([name, message]) => (
                  <li key={name}>
                    {FIELD_LABELS[name] || name}: {message}
                  </li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        {/* ================= TAB 1: SALLA COUPON RULES ================= */}
        {activeTab === "settings" && (
          <>
            <CouponScope storewide detailed />

            <Field
              label="Coupon Code"
              required
              hint="Customers enter this code at checkout."
              error={fieldError("code")}
            >
              {text("code", {
                autoComplete: "off",
                spellCheck: false,
                placeholder: "ZAWWID10",
                className: "coupon-code-input",
              })}
            </Field>

            <FormRow>
              <Field label="Discount type" required error={fieldError("type")}>
                <Select
                  value={form.type}
                  onChange={(e) => setField("type", e.target.value)}
                  options={TYPE_OPTIONS}
                />
              </Field>
              <Field label="Discount" required error={fieldError("amount")}>
                {text("amount", {
                  type: "number",
                  inputMode: "decimal",
                  min: 0,
                  step: "any",
                  suffix: form.type === "percentage" ? "%" : currency,
                })}
              </Field>
            </FormRow>

            <FormRow>
              {form.type === "percentage" && (
                <Field
                  label="Maximum discount"
                  required
                  hint="Caps the discount per order."
                  error={fieldError("maximum_amount")}
                >
                  {text("maximum_amount", {
                    type: "number",
                    inputMode: "decimal",
                    min: 0,
                    step: "any",
                    suffix: currency,
                  })}
                </Field>
              )}
              <Field
                label="Minimum order"
                hint="Optional. Cart total needed to use the coupon."
                error={fieldError("minimum_amount")}
              >
                {text("minimum_amount", {
                  type: "number",
                  inputMode: "decimal",
                  min: 0,
                  step: "any",
                  suffix: currency,
                })}
              </Field>
            </FormRow>

            <FormRow>
              <Field
                label="Start date"
                hint="Optional. Leave empty to start right away. Store time (Riyadh)."
                error={fieldError("start_date")}
              >
                {text("start_date", { type: "datetime-local" })}
              </Field>
              <Field
                label="End date"
                required
                hint="At least one day after today. Store time (Riyadh)."
                error={fieldError("expiry_date")}
              >
                {text("expiry_date", { type: "datetime-local" })}
              </Field>
            </FormRow>

            <FormRow>
              <Field
                label="Usage limit"
                hint="Optional. Total times the coupon can be used."
                error={fieldError("usage_limit")}
              >
                {text("usage_limit", {
                  type: "number",
                  inputMode: "numeric",
                  min: 1,
                  step: 1,
                })}
              </Field>
              <Field
                label="Limit per customer"
                hint="Optional."
                error={fieldError("usage_limit_per_user")}
              >
                {text("usage_limit_per_user", {
                  type: "number",
                  inputMode: "numeric",
                  min: 1,
                  step: 1,
                })}
              </Field>
            </FormRow>

            <div className="coupon-form-switches">
              <Switch
                label="Free shipping"
                description="Orders using this coupon also ship free."
                checked={form.free_shipping}
                onChange={(v) => setField("free_shipping", v)}
              />
              <Switch
                label="Exclude sale products"
                description="Products already on sale don't get the extra discount."
                checked={form.exclude_sale_products}
                onChange={(v) => setField("exclude_sale_products", v)}
              />
              <Switch
                label="Enabled"
                description="Turn off to disable the coupon without deleting it."
                checked={form.active}
                onChange={(v) => setField("active", v)}
              />
            </div>
          </>
        )}

        {/* ================= TAB 2: STOREFRONT PROMOTION & DISPLAY ================= */}
        {activeTab === "display" && (
          <div className="coupon-display-section" dir="rtl">
            {/* Quick autofill helper */}
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-secondary font-medium">
                خصص كيفية ظهور هذا الكوبون للمتسوقين في المتجر:
              </span>
              <Button
                size="small"
                variant="secondary"
                icon={Sparkles}
                onClick={handleAutoFillTexts}
              >
                توليد نصوص تلقائية
              </Button>
            </div>

            {/* 1. الشريط الإعلاني أعلى المتجر (Image 2) */}
            <div className="coupon-display-group">
              <h4 className="coupon-display-group-title">
                <Megaphone size={16} />
                1. الشريط الإعلاني أعلى المتجر (Top Announcement Bar)
              </h4>
              <Switch
                label="عرض كشريط إعلاني أعلى المتجر"
                description="يعرض شريطاً بارزاً في أعلى جميع صفحات المتجر لجذب الزوار فور دخولهم (مثل الصورة 2)."
                checked={form.show_announcement_bar}
                onChange={(v) => setField("show_announcement_bar", v)}
              />

              {form.show_announcement_bar && (
                <>
                  <Field
                    label="نص الشريط الإعلاني"
                    hint="النص الذي يظهر في الشريط الإعلاني أعلى المتجر"
                  >
                    <TextInput
                      value={form.announcement_text}
                      onChange={(e) => setField("announcement_text", e.target.value)}
                      placeholder="عروض رمضان بدأت · شحن مجاني فوق 200 ر.س · كود الخصم: ZAWWID10"
                    />
                  </Field>
                  <div className="coupon-color-row">
                    <label className="coupon-color-picker-label">
                      لون خلفية الشريط:
                      <input
                        type="color"
                        value={form.announcement_bg_color || "#f59e0b"}
                        onChange={(e) =>
                          setField("announcement_bg_color", e.target.value)
                        }
                        className="coupon-color-input"
                      />
                    </label>
                    <label className="coupon-color-picker-label">
                      لون نص الشريط:
                      <input
                        type="color"
                        value={form.announcement_text_color || "#1c1917"}
                        onChange={(e) =>
                          setField("announcement_text_color", e.target.value)
                        }
                        className="coupon-color-input"
                      />
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* 2. بطاقة الكوبون في صفحات المتجر (Image 1) */}
            <div className="coupon-display-group">
              <h4 className="coupon-display-group-title">
                <LayoutGrid size={16} />
                2. بطاقة الكوبون في صفحات المتجر (Store Pages Banner)
              </h4>
              <p className="text-xs text-secondary mb-1">
                اختر الصفحات التي يظهر فيها بانر الكوبون الداكن مع كود النسخ المتقطع (مثل الصورة 1):
              </p>
              <div className="coupon-form-switches">
                <Switch
                  label="صفحة تفاصيل المنتج (Single Product Page)"
                  description="يظهر تحت السعر مباشرة أو فوق زر الشراء لتشجيع العميل على إكمال الطلب."
                  checked={form.display_product_page}
                  onChange={(v) => setField("display_product_page", v)}
                />
                <Switch
                  label="صفحة قائمة وتصنيفات المنتجات (Products Catalog Page)"
                  description="يظهر أعلى صفحة الأقسام والمنتجات."
                  checked={form.display_category_page}
                  onChange={(v) => setField("display_category_page", v)}
                />
                <Switch
                  label="صفحة السلة (Cart Page)"
                  description="يظهر أعلى ملخص السلة ليتمكن العميل من نسخه وتطبيقه بنقرة واحدة."
                  checked={form.display_cart_page}
                  onChange={(v) => setField("display_cart_page", v)}
                />
              </div>

              <FormRow>
                <Field
                  label="عنوان الشارة (Badge Title)"
                  hint="العنوان الصغير (افتراضي: كوبون لك)"
                >
                  <TextInput
                    value={form.card_badge_title}
                    onChange={(e) => setField("card_badge_title", e.target.value)}
                    placeholder="كوبون لك"
                  />
                </Field>
                <Field
                  label="نص الخصم والترويج (Headline)"
                  hint="النص الرئيسي للخصم (افتراضي: خصم 10% على أول طلب)"
                >
                  <TextInput
                    value={form.card_headline_text}
                    onChange={(e) =>
                      setField("card_headline_text", e.target.value)
                    }
                    placeholder="خصم 10% على أول طلب"
                  />
                </Field>
              </FormRow>
            </div>

            {/* 3. Live Preview */}
            <CouponStorePreview
              code={form.code || "ZAWWID10"}
              badgeTitle={form.card_badge_title || "كوبون لك"}
              headlineText={form.card_headline_text || "خصم 10% على أول طلب"}
              showAnnouncement={form.show_announcement_bar}
              announcementText={form.announcement_text}
              announcementBg={form.announcement_bg_color || "#f59e0b"}
              announcementTextColor={form.announcement_text_color || "#1c1917"}
              cardBg={form.card_bg_color || "#092d27"}
              cardTextColor={form.card_text_color || "#67e8f9"}
              displayProductPage={form.display_product_page}
              displayCategoryPage={form.display_category_page}
              displayCartPage={form.display_cart_page}
            />

            {/* 4. Embed Code Snippet for Twilight Theme */}
            <div className="coupon-display-group">
              <div className="flex justify-between items-center">
                <h4 className="coupon-display-group-title m-0">
                  <Code size={16} />
                  كود التضمين لثيم سلة (Salla Twilight Twig Snippet)
                </h4>
                <div className="flex gap-2">
                  <Button
                    size="small"
                    variant="secondary"
                    icon={showSnippet ? Eye : Code}
                    onClick={() => setShowSnippet((prev) => !prev)}
                  >
                    {showSnippet ? "إخفاء الكود" : "عرض الكود"}
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    icon={copiedSnippet ? Check : Copy}
                    onClick={handleCopySnippet}
                  >
                    {copiedSnippet ? "تم نسخ الكود ✔" : "نسخ كود الثيم"}
                  </Button>
                </div>
              </div>
              {showSnippet && (
                <pre className="coupon-snippet-box">
                  <code>{generateCouponTwigSnippet(form.code, form)}</code>
                </pre>
              )}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
