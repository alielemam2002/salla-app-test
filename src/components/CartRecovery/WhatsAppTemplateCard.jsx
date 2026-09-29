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
        title="WhatsApp message"
        subtitle="Used by every WhatsApp button. Saved in this browser."
      />
      <div className="cart-template-body">
        <SegmentedTabs
          variant="pill"
          ariaLabel="Message language"
          tabs={MESSAGE_LOCALES.map((l) => ({ id: l.value, label: l.label }))}
          activeTab={locale}
          onTabChange={(value) => onChange({ locale: value })}
        />

        <div className="cart-template-grid">
          <div className="cart-template-editor">
            <Field
              label="Message"
              hint="A line whose variable is empty (like the coupon line with no coupon) is left out."
            >
              <Textarea
                ref={textareaRef}
                rows={9}
                dir={dir}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
            </Field>
            <div className="cart-template-vars" aria-label="Insert a variable">
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
                These variables can&apos;t be filled from Salla&apos;s cart data
                and will stay as written: {unknown.join(", ")}
              </Alert>
            )}
            <Button
              size="small"
              variant="ghost"
              icon={RotateCcw}
              onClick={() => setTemplate(DEFAULT_TEMPLATES[locale])}
            >
              Reset to default
            </Button>
          </div>

          <div className="cart-template-side">
            <Field
              label="Recovery incentive (optional)"
              hint={
                couponsError
                  ? "Coupons couldn't be loaded, so none can be added."
                  : "An existing active coupon from the Coupons tab. No coupon is created."
              }
            >
              <Select
                value={settings.couponCode}
                onChange={(e) => onChange({ couponCode: e.target.value })}
                disabled={Boolean(couponsError)}
                placeholder="No coupon"
                options={coupons.map((c) => ({ value: c.code, label: c.code }))}
              />
            </Field>

            <div className="cart-preview">
              <p className="cart-preview-label">
                Preview · sample data (Ahmed, SAR 420, 3 items)
              </p>
              <div className="cart-preview-bubble" dir={dir}>
                {preview}
              </div>
              <p className="cart-preview-count">{preview.length} characters</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
