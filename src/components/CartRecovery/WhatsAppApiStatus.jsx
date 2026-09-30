import { Settings2 } from "lucide-react";
import { Alert, Button, Switch } from "../ui/index.js";

/**
 * How reminders can be sent: manually (always), or from the app once the
 * merchant has connected their own WhatsApp Business account and the
 * "Send from the app" switch is on. Nothing secret is shown (the server
 * never returns the token).
 */
export default function WhatsAppApiStatus({
  status,
  onOpenSettings,
  onToggle,
  toggling,
}) {
  if (status.isPending || status.isError) return null;
  const {
    connected,
    enabled,
    template,
    language,
    params = [],
    invalidParams = [],
    profile,
    storageReady,
    tokenUnreadable,
  } = status.data;

  const settingsButton = (
    <Button size="small" icon={Settings2} onClick={onOpenSettings}>
      {connected || tokenUnreadable ? "إعدادات واتساب" : "ربط واتساب"}
    </Button>
  );

  if (tokenUnreadable) {
    return (
      <Alert
        tone="warning"
        title="أدخل رمز الوصول لواتساب مرة أخرى"
        action={settingsButton}
      >
        تعذّرت قراءة الرمز المحفوظ. إلى أن تدخله مرة أخرى في إعدادات واتساب،
        يمكنك إرسال التذكيرات يدويًا فقط.
      </Alert>
    );
  }

  if (!connected) {
    return (
      <Alert tone="info" title="الإرسال اليدوي فقط" action={settingsButton}>
        {storageReady
          ? "استخدم زر «واتساب» لإرسال كل تذكير بنفسك. اربط حساب واتساب للأعمال لتتمكن من الإرسال من التطبيق."
          : "استخدم زر «واتساب» لإرسال كل تذكير بنفسك. الإرسال من التطبيق يحتاج أولًا إلى تفعيل تخزين الإعدادات على الخادم (Upstash Redis و WA_SETTINGS_KEY)."}
      </Alert>
    );
  }

  return (
    <Alert
      tone={enabled && !invalidParams.length ? "success" : "info"}
      title={`تم ربط واتساب${profile?.verifiedName ? `: ${profile.verifiedName}` : ""}`}
      action={settingsButton}
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
      <p>
        {profile?.displayPhone && (
          <>
            من الرقم <span dir="ltr">{profile.displayPhone}</span> ·{" "}
          </>
        )}
        القالب <code dir="ltr">{template}</code> (
        <span dir="ltr">{language}</span>)
        {params.length ? " بالمتغيرات: " : " بلا متغيرات."}
        {params.length > 0 && (
          <>
            <span dir="ltr">{params.join(", ")}</span>.
          </>
        )}
      </p>
      {!params.length && (
        <p>
          هذا القالب لا يتضمن رابط السلة. استخدم قالبًا معتمدًا بمتغيرات
          للتذكيرات الفعلية.
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
          فتحتاج إلى ربط Meta بخطاف الويب (المرحلة 2).
        </p>
      )}
    </Alert>
  );
}
