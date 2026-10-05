import { useState } from "react";
import { FileText, Send, Settings } from "lucide-react";
import {
  Alert,
  Button,
  Field,
  Modal,
  Skeleton,
  TextInput,
} from "../ui/index.js";
import TemplatePicker from "../whatsapp/TemplatePicker.jsx";
import {
  useWhatsAppSettings,
  useWhatsAppSettingsMutations,
} from "../../hooks/cartRecovery/useCartRecovery.js";
import { useWhatsAppTemplates } from "../../hooks/settings/useSettings.js";
import {
  useSaveTemplateBinding,
  useTemplateBindings,
} from "../../hooks/whatsapp/useTemplateBindings.js";
import { BINDING_SOURCES } from "../../utils/whatsapp/templateBinding.js";

const reasonOf = (error) =>
  error?.result?.error || "حدث خطأ ما. حاول مرة أخرى.";

/**
 * The cart reminder template: one of the merchant's approved templates
 * (Settings → library read from Meta) and what fills each variable. The
 * WhatsApp account itself lives in the Settings tab.
 */
export default function CartTemplateModal({
  getToken,
  onClose,
  onOpenSettings,
  showToast,
}) {
  const account = useWhatsAppSettings(getToken);
  const templates = useWhatsAppTemplates(getToken);
  const bindings = useTemplateBindings(getToken);
  const saveBinding = useSaveTemplateBinding(getToken);
  const { sendTest } = useWhatsAppSettingsMutations(getToken);
  const [draft, setDraft] = useState(null);
  const [testTo, setTestTo] = useState("");

  const saved = bindings.data?.bindings?.cart || null;
  const value = draft || {
    templateId: saved?.templateId || "",
    slots: saved?.slots || [],
  };
  const connected = Boolean(account.data?.settings?.tokenLast4);

  const save = () =>
    saveBinding.mutate(
      { feature: "cart", binding: value },
      {
        onSuccess: () => {
          setDraft(null);
          showToast?.("تم حفظ قالب تذكير السلة", "success");
        },
      },
    );

  let body;
  if (account.isPending || templates.isPending || bindings.isPending) {
    body = <Skeleton height={180} />;
  } else if (!connected) {
    body = (
      <Alert
        tone="info"
        title="اربط حساب واتساب أولًا"
        action={
          <Button size="small" icon={Settings} onClick={onOpenSettings}>
            الإعدادات
          </Button>
        }
      >
        حساب واتساب للأعمال وقوالبك في تبويب «الإعدادات». بعد ربطه اختر قالب
        التذكير هنا.
      </Alert>
    );
  } else {
    const profile = account.data.settings.profile;
    body = (
      <div className="wa-settings">
        <p className="form-hint">
          الإرسال من{" "}
          <strong>{profile?.verifiedName || "حساب واتساب للأعمال"}</strong>
          {profile?.displayPhone && (
            <>
              {" "}
              (<span dir="ltr">{profile.displayPhone}</span>)
            </>
          )}
          . لتغيير الحساب افتح تبويب «الإعدادات».
        </p>
        <TemplatePicker
          label="قالب تذكير السلة"
          templates={templates.data?.templates}
          value={value}
          onChange={setDraft}
          sources={BINDING_SOURCES.cart}
          onOpenSettings={onOpenSettings}
        />
        {saveBinding.error && (
          <Alert tone="error">{reasonOf(saveBinding.error)}</Alert>
        )}

        {saved && (
          <div className="wa-test">
            <Field
              label="رسالة تجربة"
              hint="تُرسل القالب المحفوظ ببيانات سلة تجريبية."
            >
              <TextInput
                dir="ltr"
                placeholder="+9665XXXXXXXX"
                aria-label="رقم رسالة التجربة"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
            </Field>
            <Button
              size="small"
              variant="secondary"
              icon={Send}
              loading={sendTest.isPending}
              disabled={!testTo.trim()}
              onClick={() =>
                sendTest.mutate(testTo, {
                  onSuccess: () =>
                    showToast?.("قبلت Meta رسالة التجربة", "success"),
                })
              }
            >
              إرسال تجربة
            </Button>
            {sendTest.error && (
              <Alert tone="error">{reasonOf(sendTest.error)}</Alert>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      dir="rtl"
      size="lg"
      icon={FileText}
      title="قالب تذكير السلة"
      subtitle="القالب الذي يرسله زر «إرسال» والإرسال الجماعي."
      dismissible={!saveBinding.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
          {connected && (
            <Button
              variant="primary"
              onClick={save}
              loading={saveBinding.isPending}
              disabled={!draft || !value.templateId}
            >
              حفظ القالب
            </Button>
          )}
        </>
      }
    >
      {body}
    </Modal>
  );
}
