import { useState, useMemo, useEffect } from "react";
import { MessageCircle, Copy, ExternalLink, RotateCcw } from "lucide-react";
import { Modal, Button, Textarea, Badge } from "../ui/index.js";
import {
  DEFAULT_REPLENISH_TEXT,
  renderReplenishMessage,
  replenishWhatsappUrl,
} from "../../utils/replenish/replenishModel.js";
import { useClipboard } from "../../hooks/ui/useClipboard.js";

/**
 * Modal to compose and send a free-form WhatsApp message for a replenish reminder.
 * The merchant can write or edit any text by hand, insert dynamic variables,
 * preview the rendered result, and send it directly via WhatsApp (wa.me) in one click.
 */
export default function ReplenishMessageModal({
  isOpen,
  onClose,
  reminder,
  defaultTemplate,
  couponCode = "",
  showToast,
  onSent,
}) {
  const [customText, setCustomText] = useState("");
  const { copy } = useClipboard();

  useEffect(() => {
    if (reminder) {
      setCustomText(defaultTemplate || DEFAULT_REPLENISH_TEXT);
    }
  }, [reminder, defaultTemplate]);

  const customerName = reminder?.customerName || "العميل";
  const mobile = reminder?.mobile || "";
  const productName = reminder?.productName || "المنتج";
  const productUrl = reminder?.productUrl || "";

  const renderedMessage = useMemo(() => {
    if (!reminder) return "";
    return renderReplenishMessage(customText, reminder, { couponCode });
  }, [customText, reminder, couponCode]);

  const waUrl = useMemo(() => {
    if (!mobile || !renderedMessage) return null;
    return replenishWhatsappUrl(mobile, renderedMessage);
  }, [mobile, renderedMessage]);

  const handleInsertVariable = (varTag) => {
    setCustomText((prev) => `${prev} ${varTag} `);
  };

  const handleResetToDefault = () => {
    setCustomText(DEFAULT_REPLENISH_TEXT);
  };

  const handleCopy = async () => {
    const ok = await copy(renderedMessage);
    showToast?.(
      ok ? "تم نسخ نص الرسالة بنجاح" : "تعذّر النسخ",
      ok ? "success" : "error",
    );
  };

  const handleOpenWhatsApp = () => {
    if (!waUrl) return;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    onSent?.(reminder?.id);
    showToast?.(`تم فتح واتساب لمراسلة ${customerName}`, "success");
    onClose();
  };

  if (!isOpen || !reminder) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="كتابة تذكير إعادة الشراء وإرساله عبر واتساب"
      subtitle={`مراسلة ${customerName} بشأن: ${productName}`}
      icon={MessageCircle}
      size="md"
      dir="rtl"
      footer={
        <div className="cart-actions" style={{ justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              variant="secondary"
              icon={Copy}
              onClick={handleCopy}
              title="نسخ نص الرسالة للحافظة"
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
                return;
              }
              onSent?.(reminder.id);
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
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Info card */}
        <div
          style={{
            background: "var(--bg-secondary)",
            padding: "12px 14px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-color)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>العميل: </strong>
              <span>{customerName}</span>
              <span style={{ margin: "0 6px", color: "var(--text-secondary)" }}>•</span>
              <span dir="ltr" style={{ color: "var(--text-secondary)" }}>
                {mobile}
              </span>
            </div>
            {reminder.quantity > 1 && (
              <Badge tone="info">الكمية: {reminder.quantity}</Badge>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.85rem" }}>
            <div>
              <strong>المنتج: </strong>
              <span>{productName}</span>
            </div>
            {productUrl && (
              <a
                href={productUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "var(--color-primary)",
                  fontSize: "0.82rem",
                }}
              >
                <span>فتح صفحة المنتج</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>

        {/* Message Editor */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
              اكتب نص الرسالة التي تريد إرسالها:
            </label>
            <button
              type="button"
              onClick={handleResetToDefault}
              className="btn btn-ghost btn-small"
              style={{ fontSize: "0.78rem", padding: "2px 6px" }}
              title="استعادة النص الافتراضي"
            >
              <RotateCcw size={12} /> استعادة النص المقترح
            </button>
          </div>

          <Textarea
            rows={5}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="اكتب رسالتك للعميل هنا..."
          />

          {/* Quick variable tags */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              إدراج متغير:
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              style={{ fontSize: "0.76rem", padding: "2px 8px" }}
              onClick={() => handleInsertVariable("{{customer_name}}")}
            >
              + اسم العميل
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              style={{ fontSize: "0.76rem", padding: "2px 8px" }}
              onClick={() => handleInsertVariable("{{product_name}}")}
            >
              + اسم المنتج
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              style={{ fontSize: "0.76rem", padding: "2px 8px" }}
              onClick={() => handleInsertVariable("{{product_url}}")}
            >
              + رابط المنتج
            </button>
            {couponCode && (
              <button
                type="button"
                className="btn btn-secondary btn-small"
                style={{ fontSize: "0.76rem", padding: "2px 8px" }}
                onClick={() => handleInsertVariable("{{coupon_code}}")}
              >
                + كود الكوبون
              </button>
            )}
          </div>
        </div>

        {/* Live Preview Box */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label className="form-label" style={{ fontWeight: 600, margin: 0, fontSize: "0.82rem" }}>
            معاينة الرسالة الحقيقية كما ستصل للعميل:
          </label>
          <div
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              padding: "12px",
              whiteSpace: "pre-wrap",
              fontSize: "0.88rem",
              lineHeight: 1.5,
              color: "var(--text-primary)",
              maxHeight: "150px",
              overflowY: "auto",
            }}
          >
            {renderedMessage || "لا يوجد نص."}
          </div>
        </div>
      </div>
    </Modal>
  );
}
