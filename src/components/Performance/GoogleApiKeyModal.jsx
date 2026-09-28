import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Key, Trash2 } from "lucide-react";
import { Button, Field, Modal, TextInput } from "../ui/index.js";

const FORM_ID = "perf-api-key-form";
const KEY_DOCS_URL =
  "https://developers.google.com/speed/docs/insights/v5/get-started";

/**
 * Dialog to enter the optional Google PageSpeed API key.
 * Persistence is the caller's job (see useGoogleApiKey). Mount it only while
 * open so the input starts from the stored key each time.
 */
export default function GoogleApiKeyModal({
  isOpen,
  onClose,
  initialKey = "",
  onSave,
  onClear,
}) {
  const [value, setValue] = useState(initialKey);
  const [isSaved, setIsSaved] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(value.trim());
    setIsSaved(true);
    closeTimer.current = setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  const handleClear = () => {
    setValue("");
    onClear();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      icon={Key}
      className="perf-modal"
      title="إعداد مفتاح Google API المجاني"
      subtitle="Google PageSpeed API Key"
      footer={
        <>
          {value && (
            <Button
              variant="ghost"
              size="small"
              icon={Trash2}
              onClick={handleClear}
              className="perf-modal-footer-start"
            >
              حذف المفتاح
            </Button>
          )}
          <Button onClick={onClose}>إلغاء</Button>
          <Button
            type="submit"
            form={FORM_ID}
            variant="primary"
            icon={isSaved ? Check : undefined}
          >
            {isSaved ? "تم الحفظ بنجاح!" : "حفظ المفتاح"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="form-section">
        <p className="perf-block-text">
          يمنحك مفتاح Google API الشخصي{" "}
          <strong>25,000 فحص يومياً مجاناً</strong> بدون التعرض لحدود الاستخدام
          العامة (429 Quota Exceeded)، ويضمن سرعة فحص متجرك في ثوانٍ معدودة.
        </p>

        <Field
          label="مفتاح API الخاص بك (API Key):"
          hint="يتم حفظ المفتاح بأمان في متصفحك وإرساله لخادم الفحص لتفويض طلبات Google فقط."
        >
          <TextInput
            id="google-api-key-input"
            type="text"
            placeholder="AIzaSy..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            dir="ltr"
            autoComplete="off"
          />
        </Field>

        <div className="perf-callout">
          <span className="perf-block-title">
            كيف تستخرج المفتاح مجاناً في دقيقة؟
          </span>
          <ol className="perf-steps perf-steps--compact">
            <li className="perf-step">
              <span className="perf-step-num">1</span>
              <span>
                ادخل على الرابط السريع:{" "}
                <a href={KEY_DOCS_URL} target="_blank" rel="noreferrer">
                  Get a Key <ExternalLink size={11} aria-hidden="true" />
                </a>
              </span>
            </li>
            <li className="perf-step">
              <span className="perf-step-num">2</span>
              <span>
                اختر اسماً للمشروع واضغط <strong>Next</strong>.
              </span>
            </li>
            <li className="perf-step">
              <span className="perf-step-num">3</span>
              <span>انسخ المفتاح الذي يظهر لك وضعه هنا.</span>
            </li>
          </ol>
        </div>
      </form>
    </Modal>
  );
}
