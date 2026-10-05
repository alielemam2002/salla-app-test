import { X } from "lucide-react";
import { Alert, Button } from "../ui/index.js";

/**
 * Where "Connect WhatsApp with Facebook" is (useEmbeddedSignup): the popup
 * is open, the connection is being saved, or how it ended.
 */
export default function EmbeddedSignupNotice({ signup }) {
  const { phase } = signup;
  if (phase === "idle") return null;

  const dismiss = (
    <Button size="small" variant="ghost" icon={X} onClick={signup.reset}>
      إخفاء
    </Button>
  );

  if (phase === "open") {
    return (
      <Alert tone="info" title="أكمل الربط في نافذة فيسبوك">
        اختر نشاطك التجاري وحساب واتساب للأعمال والرقم في نافذة Meta. إن لم تظهر
        النافذة، اسمح للمتصفح بفتح النوافذ المنبثقة لهذه الصفحة ثم اضغط الزر مرة
        أخرى.
      </Alert>
    );
  }
  if (phase === "saving") {
    return (
      <Alert tone="info" title="جارٍ حفظ الربط…">
        نتحقق من الحساب مع Meta ونفعّل الرقم ونقرأ قوالبك.
      </Alert>
    );
  }
  if (phase === "cancelled") {
    return (
      <Alert tone="info" title="لم يكتمل الربط" action={dismiss}>
        أُغلقت نافذة فيسبوك قبل إكمال الخطوات
        {signup.step && (
          <>
            {" "}
            (عند الخطوة <code dir="ltr">{signup.step}</code>)
          </>
        )}
        . يمكنك المحاولة مرة أخرى في أي وقت.
      </Alert>
    );
  }
  if (phase === "error") {
    return (
      <Alert tone="error" title="تعذّر ربط واتساب" action={dismiss}>
        {signup.error}
      </Alert>
    );
  }

  const warnings = signup.warnings || [];
  const notes = signup.templatesError
    ? [...warnings, `تعذّرت قراءة القوالب: ${signup.templatesError}`]
    : warnings;
  return (
    <Alert
      tone={notes.length ? "warning" : "success"}
      title="تم ربط واتساب عبر فيسبوك"
      action={dismiss}
    >
      {notes.length ? (
        <ul>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : (
        "اختر قالب التذكير من «قالب التذكير». لإرسال رسائل لعملائك أضف وسيلة دفع لحسابك في مدير واتساب من Meta."
      )}
    </Alert>
  );
}
