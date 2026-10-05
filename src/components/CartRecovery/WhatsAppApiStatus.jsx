import { Facebook, FileText, Settings } from "lucide-react";
import { Alert, Button, Switch } from "../ui/index.js";
import {
  BINDING_SOURCES,
  CUSTOM_SOURCE,
  slotLabel,
} from "../../utils/whatsapp/templateBinding.js";

const SOURCE_LABELS = new Map(
  BINDING_SOURCES.cart.map((s) => [s.key, s.label]),
);

/**
 * How reminders can be sent: manually (always), or from the app once the
 * merchant has connected their WhatsApp Business account (Settings tab),
 * picked the reminder template, and the "Send from the app" switch is on.
 * `signup` (useEmbeddedSignup) adds "Connect with Facebook" when the
 * server has Embedded Signup set up.
 * Nothing secret is shown (the server never returns the token).
 */
export default function WhatsAppApiStatus({
  status,
  signup,
  onOpenTemplate,
  onOpenSettings,
  onToggle,
  toggling,
}) {
  if (status.isPending || status.isError) return null;
  const {
    connected,
    enabled,
    cartBinding,
    template,
    language,
    params = [],
    invalidParams = [],
    profile,
    storageReady,
    tokenUnreadable,
  } = status.data;

  // A reminder without the checkout link can't bring the customer back.
  const hasCartLink = cartBinding
    ? cartBinding.slots.some((slot) => slot.source === "checkout_url")
    : params.includes("checkout_url");

  const settingsButton = (
    <Button size="small" icon={Settings} onClick={onOpenSettings}>
      الإعدادات
    </Button>
  );
  // Embedded Signup: must open the popup right in the click.
  const connectButton = signup?.available && (
    <Button
      size="small"
      variant="primary"
      icon={Facebook}
      loading={signup.busy}
      disabled={!signup.ready}
      onClick={signup.start}
    >
      ربط واتساب عبر فيسبوك
    </Button>
  );
  const actions = connectButton ? (
    <div className="wa-connect-actions">
      {connectButton}
      {settingsButton}
    </div>
  ) : (
    settingsButton
  );

  if (tokenUnreadable) {
    return (
      <Alert
        tone="warning"
        title="أدخل رمز الوصول لواتساب مرة أخرى"
        action={actions}
      >
        تعذّرت قراءة الرمز المحفوظ. أعد الربط عبر فيسبوك أو أدخله مرة أخرى من
        تبويب «الإعدادات»؛ إلى ذلك الحين يمكنك إرسال التذكيرات يدويًا فقط.
      </Alert>
    );
  }

  if (!connected) {
    return (
      <Alert tone="info" title="الإرسال اليدوي فقط" action={actions}>
        {!storageReady
          ? "استخدم زر «واتساب» لإرسال كل تذكير بنفسك. الإرسال من التطبيق يحتاج أولًا إلى تفعيل تخزين الإعدادات على الخادم (Upstash Redis و WA_SETTINGS_KEY)."
          : connectButton
            ? "استخدم زر «واتساب» لإرسال كل تذكير بنفسك، أو اضغط «ربط واتساب عبر فيسبوك»: تختار نشاطك التجاري وحساب واتساب للأعمال والرقم في نافذة من Meta، ونحفظ الربط تلقائيًا دون نسخ أي رموز. (أو أدخل البيانات يدويًا من «الإعدادات».)"
            : "استخدم زر «واتساب» لإرسال كل تذكير بنفسك. اربط حساب واتساب للأعمال من تبويب «الإعدادات» لتتمكن من الإرسال من التطبيق."}
      </Alert>
    );
  }

  return (
    <Alert
      tone={enabled && template && !invalidParams.length ? "success" : "info"}
      title={`تم ربط واتساب${profile?.verifiedName ? `: ${profile.verifiedName}` : ""}`}
      action={
        <Button size="small" icon={FileText} onClick={onOpenTemplate}>
          قالب التذكير
        </Button>
      }
    >
      <Switch
        label="الإرسال من التطبيق"
        description={
          enabled
            ? "أزرار «إرسال» تستخدم حساب واتساب للأعمال الخاص بك."
            : "متوقف: الإرسال اليدوي فقط (زر «واتساب»)."
        }
        checked={enabled}
        disabled={toggling}
        onChange={onToggle}
      />
      {cartBinding ? (
        <p>
          القالب <code dir="ltr">{cartBinding.name}</code> (
          <span dir="ltr">{cartBinding.language}</span>)
          {cartBinding.slots.length ? ": " : " بلا متغيرات."}
          {cartBinding.slots
            .map(
              (slot) =>
                `${slotLabel(slot)} = ${
                  slot.source === CUSTOM_SOURCE
                    ? `«${slot.value}»`
                    : SOURCE_LABELS.get(slot.source) || slot.source
                }`,
            )
            .join("، ")}
        </p>
      ) : template ? (
        <p>
          القالب <code dir="ltr">{template}</code> (
          <span dir="ltr">{language}</span>)
          {params.length ? " بالمتغيرات: " : " بلا متغيرات."}
          {params.length > 0 && (
            <>
              <span dir="ltr">{params.join(", ")}</span>.
            </>
          )}{" "}
          اختر قالبًا من قوالبك من «قالب التذكير».
        </p>
      ) : (
        <p>لم تختر قالب التذكير بعد: اضغط «قالب التذكير».</p>
      )}
      {(cartBinding || template) && !hasCartLink && (
        <p>
          هذا القالب لا يتضمن رابط السلة. اختر قالبًا فيه متغير أو زر لرابط
          إكمال الطلب.
        </p>
      )}
      {invalidParams.length > 0 && (
        <p>
          متغيرات قالب غير معروفة:{" "}
          <span dir="ltr">{invalidParams.join(", ")}</span>
        </p>
      )}
      {enabled && (
        <p>
          «تم الإرسال» تعني أن Meta قبلت الرسالة؛ أما حالة التسليم والقراءة
          فتحتاج إلى ربط Meta بخطاف الويب.
        </p>
      )}
    </Alert>
  );
}
