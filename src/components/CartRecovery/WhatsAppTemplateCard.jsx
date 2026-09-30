import { useRef } from "react";
import { MessageSquareText, RotateCcw } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  Field,
  SegmentedTabs,
  Select,
  Textarea,
} from "../ui/index.js";
import {
  DEFAULT_TEMPLATES,
  MESSAGE_LOCALES,
  SAMPLE_CART,
  TEMPLATE_VARIABLES,
  cartMessageValues,
  renderTemplate,
  unknownVariables,
} from "../../utils/cartRecovery/whatsappMessage.js";

/**
 * Edit the WhatsApp recovery message (per language), pick an existing
 * coupon, and preview it with sample data. Saved in this browser.
 */
export default function WhatsAppTemplateCard({
  settings,
  onChange,
  coupons,
  couponsError,
}) {
  const textareaRef = useRef(null);
  const { locale } = settings;
  const template = settings.templates?.[locale] ?? DEFAULT_TEMPLATES[locale];
  const dir = MESSAGE_LOCALES.find((l) => l.value === locale)?.dir || "ltr";
  const unknown = unknownVariables(template);
  const preview = renderTemplate(
    template,
    cartMessageValues(SAMPLE_CART, {
      locale,
      couponCode: settings.couponCode,
    }),
  );

  const setTemplate = (text) =>
    onChange({ templates: { ...settings.templates, [locale]: text } });

  const insertVariable = (key) => {
    const el = textareaRef.current;
    const token = `{{${key}}}`;
    if (!el) {
      setTemplate(`${template}${token}`);
      return;
    }
    const start = el.selectionStart ?? template.length;
    const end = el.selectionEnd ?? template.length;
    setTemplate(template.slice(0, start) + token + template.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <Card className="cart-template">
      <Card.Header
        icon={MessageSquareText}
        title="رسالة واتساب"
        subtitle="تُستخدم مع زر واتساب اليدوي، ومع زر «إرسال» عند اختيار «رسالة نصية». تُحفظ في هذا المتصفح."
      />
      <div className="cart-template-body">
        <SegmentedTabs
          variant="pill"
          ariaLabel="لغة الرسالة"
          tabs={MESSAGE_LOCALES.map((l) => ({ id: l.value, label: l.label }))}
          activeTab={locale}
          onTabChange={(value) => onChange({ locale: value })}
        />

        <div className="cart-template-grid">
          <div className="cart-template-editor">
            <Field
              label="نص الرسالة"
              hint="السطر الذي يحتوي على متغير فارغ (مثل سطر الكوبون عند عدم اختيار كوبون) يُحذف تلقائيًا."
            >
              <Textarea
                ref={textareaRef}
                rows={9}
                dir={dir}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
            </Field>
            <div className="cart-template-vars" aria-label="إدراج متغير">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className="cart-var-chip"
                  title={v.label}
                  onClick={() => insertVariable(v.key)}
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>
            {unknown.length > 0 && (
              <Alert tone="warning">
                لا يمكن تعبئة هذه المتغيرات من بيانات السلة وستبقى كما كُتبت:{" "}
                <span dir="ltr">{unknown.join(", ")}</span>
              </Alert>
            )}
            <Button
              size="small"
              variant="ghost"
              icon={RotateCcw}
              onClick={() => setTemplate(DEFAULT_TEMPLATES[locale])}
            >
              استعادة النص الافتراضي
            </Button>
          </div>

          <div className="cart-template-side">
            <Field
              label="حافز الاسترجاع (اختياري)"
              hint={
                couponsError
                  ? "تعذّر تحميل الكوبونات، لذا لا يمكن إضافة كوبون."
                  : "اختر كوبونًا نشطًا من تبويب الكوبونات. لن يتم إنشاء كوبون جديد."
              }
            >
              <Select
                value={settings.couponCode}
                onChange={(e) => onChange({ couponCode: e.target.value })}
                disabled={Boolean(couponsError)}
                placeholder="بدون كوبون"
                options={coupons.map((c) => ({ value: c.code, label: c.code }))}
              />
            </Field>

            <div className="cart-preview">
              <p className="cart-preview-label">
                معاينة · بيانات تجريبية (Ahmed Ali، SAR 420، 3 منتجات)
              </p>
              <div className="cart-preview-bubble" dir={dir}>
                {preview}
              </div>
              <p className="cart-preview-count">{preview.length} حرفًا</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
