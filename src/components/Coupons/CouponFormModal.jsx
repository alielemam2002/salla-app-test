import { useId } from "react";
import { Ticket } from "lucide-react";
import {
  Alert,
  Button,
  Field,
  FormRow,
  Modal,
  SegmentedTabs,
  Select,
  Switch,
  TextInput,
} from "../ui/index.js";
import { useCouponForm } from "../../hooks/coupons/useCouponForm.js";
import { FIELD_LABELS } from "../../utils/coupons/couponErrors.js";
import CouponScope from "./CouponScope.jsx";
import CouponProductPicker from "./CouponProductPicker.jsx";

const TYPE_OPTIONS = [
  { value: "percentage", label: "نسبة مئوية (%)" },
  { value: "fixed", label: "مبلغ ثابت" },
];

/**
 * Create / edit a coupon (storewide or targeted to a specific product).
 * `serverError` is the described Salla error ({ title, reason, fieldErrors }).
 */
export default function CouponFormModal({
  isOpen,
  coupon,
  currency = "SAR",
  saving,
  serverError,
  onClose,
  onSubmit,
  getToken,
}) {
  const formId = useId();
  const isEdit = Boolean(coupon);
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dismissible={!saving}
      icon={Ticket}
      title={isEdit ? `تعديل الكوبون ${coupon.code}` : "إنشاء كوبون"}
      subtitle="كود خصم على المتجر بالكامل"
      size="lg"
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            loading={saving}
          >
            {isEdit ? "حفظ" : "إنشاء كوبون"}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="coupon-form"
        onSubmit={handleSubmit}
        noValidate
      >
        {serverError && (
          <Alert tone="error" title={serverError.title}>
            <p>رفضت سلة الطلب: {serverError.reason}</p>
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

        <div className="coupon-target-mode">
          <span className="form-label">نطاق تطبيق الكوبون</span>
          <SegmentedTabs
            variant="pill"
            ariaLabel="نطاق تطبيق الكوبون"
            tabs={[
              { id: "storewide", label: "المتجر بالكامل" },
              { id: "specific_product", label: "منتج محدد" },
            ]}
            activeTab={form.target_type || "storewide"}
            onTabChange={(mode) => setField("target_type", mode)}
          />
        </div>

        {form.target_type === "specific_product" ? (
          <CouponProductPicker
            selectedIds={form.include_product_ids || []}
            selectedProduct={form.selected_product}
            onSelect={(product) => {
              setField("include_product_ids", [product.id]);
              setField("selected_product", product);
            }}
            onRemove={() => {
              setField("include_product_ids", []);
              setField("selected_product", null);
            }}
            getToken={getToken}
            error={fieldError("include_product_ids")}
          />
        ) : (
          <CouponScope storewide detailed />
        )}

        <Field
          label="كود الكوبون"
          required
          hint="يكتب العميل هذا الكود عند إتمام الطلب."
          error={fieldError("code")}
        >
          {text("code", {
            autoComplete: "off",
            spellCheck: false,
            placeholder: "SUMMER20",
            className: "coupon-code-input",
            dir: "ltr",
          })}
        </Field>

        <FormRow>
          <Field label="نوع الخصم" required error={fieldError("type")}>
            <Select
              value={form.type}
              onChange={(e) => setField("type", e.target.value)}
              options={TYPE_OPTIONS}
            />
          </Field>
          <Field label="قيمة الخصم" required error={fieldError("amount")}>
            {text("amount", {
              type: "number",
              inputMode: "decimal",
              min: 0,
              step: "any",
              suffix: form.type === "percentage" ? "%" : currency,
              dir: "ltr",
            })}
          </Field>
        </FormRow>

        <FormRow>
          {form.type === "percentage" && (
            <Field
              label="الحد الأقصى للخصم"
              required
              hint="أعلى مبلغ خصم يحصل عليه العميل في الطلب الواحد."
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
            label="الحد الأدنى للطلب"
            hint="اختياري. أقل إجمالي للسلة لاستخدام الكوبون."
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
            label="تاريخ البداية"
            hint="اختياري. اتركه فارغًا ليبدأ الكوبون فورًا. بتوقيت المتجر (الرياض)."
            error={fieldError("start_date")}
          >
            {text("start_date", { type: "datetime-local", dir: "ltr" })}
          </Field>
          <Field
            label="تاريخ الانتهاء"
            required
            hint="بعد اليوم بيوم واحد على الأقل. بتوقيت المتجر (الرياض)."
            error={fieldError("expiry_date")}
          >
            {text("expiry_date", { type: "datetime-local", dir: "ltr" })}
          </Field>
        </FormRow>

        <FormRow>
          <Field
            label="حد الاستخدام"
            hint="اختياري. إجمالي عدد مرات استخدام الكوبون."
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
            label="حد الاستخدام لكل عميل"
            hint="اختياري."
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
            label="شحن مجاني"
            description="الطلبات التي تستخدم هذا الكوبون يكون شحنها مجانيًا."
            checked={form.free_shipping}
            onChange={(v) => setField("free_shipping", v)}
          />
          <Switch
            label="استثناء المنتجات المخفضة"
            description="المنتجات المخفضة أصلًا لا يشملها خصم الكوبون."
            checked={form.exclude_sale_products}
            onChange={(v) => setField("exclude_sale_products", v)}
          />
          <Switch
            label="مفعّل"
            description="أوقف التفعيل لتعطيل الكوبون دون حذفه."
            checked={form.active}
            onChange={(v) => setField("active", v)}
          />
        </div>
      </form>
    </Modal>
  );
}
