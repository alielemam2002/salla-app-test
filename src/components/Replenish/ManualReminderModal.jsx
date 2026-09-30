import { useState, useMemo, useEffect } from "react";
import {
  MessageCircle,
  Copy,
  ExternalLink,
  Send,
  Package,
  User,
} from "lucide-react";
import {
  Modal,
  Button,
  TextInput,
  Textarea,
  Select,
  FormRow,
  Field,
} from "../ui/index.js";
import {
  DEFAULT_REPLENISH_TEXT,
  renderReplenishMessage,
  replenishWhatsappUrl,
} from "../../utils/replenish/replenishModel.js";
import { useClipboard } from "../../hooks/ui/useClipboard.js";

/**
 * Modal to compose and send a replenishment reminder to ANY specific customer,
 * selecting any product from the store or entering customer details manually.
 */
export default function ManualReminderModal({
  isOpen,
  onClose,
  products = [],
  cycles = {},
  defaultTemplate,
  couponCode = "",
  showToast,
  onSent,
}) {
  const [customerName, setCustomerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [customText, setCustomText] = useState("");
  const { copy } = useClipboard();

  useEffect(() => {
    if (isOpen) {
      setCustomText(defaultTemplate || DEFAULT_REPLENISH_TEXT);
    }
  }, [isOpen, defaultTemplate]);

  // When a product is selected from store products
  const handleProductSelect = (id) => {
    setSelectedProductId(id);
    const prod = products.find((p) => String(p.id) === String(id));
    if (prod) {
      setProductName(prod.name || "");
      setProductUrl(
        prod.url || (prod.id ? `https://salla.sa/product/${prod.id}` : ""),
      );
    }
  };

  // Mock reminder object for rendering
  const reminderObj = useMemo(
    () => ({
      customerName: customerName || "العميل",
      mobile,
      productId: selectedProductId,
      productName: productName || "المنتج",
      productUrl,
      quantity: Number(quantity) || 1,
    }),
    [
      customerName,
      mobile,
      selectedProductId,
      productName,
      productUrl,
      quantity,
    ],
  );

  const renderedMessage = useMemo(() => {
    return renderReplenishMessage(customText, reminderObj, { couponCode });
  }, [customText, reminderObj, couponCode]);

  const waUrl = useMemo(() => {
    if (!mobile || !renderedMessage) return null;
    return replenishWhatsappUrl(mobile, renderedMessage);
  }, [mobile, renderedMessage]);

  const handleCopy = async () => {
    const ok = await copy(renderedMessage);
    showToast?.(
      ok ? "تم نسخ نص التذكير بنجاح" : "تعذّر النسخ",
      ok ? "success" : "error",
    );
  };

  const productOptions = useMemo(() => {
    return [
      { value: "", label: "— اختر منتجاً من المتجر —" },
      ...products.map((p) => ({
        value: String(p.id),
        label: p.name || `منتج ${p.id}`,
      })),
    ];
  }, [products]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="إرسال تذكير إعادة شراء لعميل محدد"
      subtitle="اختر العميل والمنتج وأرسل له التذكير مباشرة على واتساب مع رابط المنتج."
      icon={Send}
      size="md"
      dir="rtl"
      footer={
        <div
          className="cart-actions"
          style={{ justifyContent: "space-between", width: "100%" }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <Button variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              variant="secondary"
              icon={Copy}
              onClick={handleCopy}
              title="نسخ نص الرسالة"
            >
              نسخ النص
            </Button>
          </div>

          <a
            className={`btn btn-success${!waUrl ? " disabled" : ""}`}
            href={waUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!waUrl) {
                e.preventDefault();
                showToast?.("أدخل رقم جوال صالح أولاً لمراسلة العميل", "error");
                return;
              }
              onSent?.(reminderObj);
              onClose();
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <MessageCircle size={15} aria-hidden="true" />
            <span>فتح واتساب والإرسال 💬</span>
          </a>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* Customer Info Form */}
        <FormRow columns={2}>
          <Field label="اسم العميل">
            <TextInput
              placeholder="مثال: عبد الله محمد"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </Field>
          <Field
            label="رقم جوال العميل (واتساب)"
            hint="مع مفتاح الدولة، مثل 9665XXXXXXXX"
          >
            <TextInput
              dir="ltr"
              placeholder="+966500000000"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </Field>
        </FormRow>

        {/* Product Selection */}
        <FormRow columns={2}>
          <Field label="اختر منتج من المتجر">
            <Select
              value={selectedProductId}
              onChange={(e) => handleProductSelect(e.target.value)}
              options={productOptions}
            />
          </Field>
          <Field label="اسم المنتج (أو اكتبه يدوياً)">
            <TextInput
              placeholder="مثال: حبوب قهوة مختصة"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </Field>
        </FormRow>

        <FormRow columns={2}>
          <Field
            label="رابط صفحة المنتج بالمتجر"
            hint="الرابط المباشر الذي سيصله على واتساب للشراء"
          >
            <TextInput
              dir="ltr"
              placeholder="https://salla.sa/yourstore/product"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
            />
          </Field>
          <Field label="الكمية السابقة">
            <TextInput
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
        </FormRow>

        {/* Message Editor */}
        <Field label="نص الرسالة التي ستصل للعميل:">
          <Textarea
            rows={4}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="اكتب رسالتك..."
          />
        </Field>

        {/* Live Preview */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label
            className="form-label"
            style={{ fontWeight: 600, fontSize: "0.82rem", margin: 0 }}
          >
            معاينة الرسالة الحقيقية في واتساب:
          </label>
          <div
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              padding: "10px",
              whiteSpace: "pre-wrap",
              fontSize: "0.86rem",
              lineHeight: 1.5,
              maxHeight: "120px",
              overflowY: "auto",
            }}
          >
            {renderedMessage}
          </div>
        </div>
      </div>
    </Modal>
  );
}
