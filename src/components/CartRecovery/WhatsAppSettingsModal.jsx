import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Plus, Send, Settings2, Trash2, X } from "lucide-react";
import {
  Alert,
  Button,
  Field,
  FormRow,
  IconButton,
  Modal,
  Select,
  Skeleton,
  TextInput,
} from "../ui/index.js";
import {
  useWhatsAppSettings,
  useWhatsAppSettingsMutations,
} from "../../hooks/cartRecovery/useCartRecovery.js";
import { TEMPLATE_VARIABLES } from "../../utils/cartRecovery/whatsappMessage.js";

const ID = /^\d{5,25}$/;

const schema = z.object({
  phoneNumberId: z
    .string()
    .trim()
    .regex(ID, "استخدم معرّف رقم الهاتف (أرقام فقط)"),
  wabaId: z
    .string()
    .trim()
    .refine((v) => !v || ID.test(v), "استخدم معرّف الحساب (أرقام فقط)"),
  accessToken: z.string().trim(),
  template: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,512}$/, "أحرف إنجليزية صغيرة وأرقام و _ فقط"),
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, "رمز لغة مثل ar أو en_US"),
  params: z.array(z.object({ key: z.string().min(1, "اختر قيمة") })).max(10),
});

const EMPTY = {
  phoneNumberId: "",
  wabaId: "",
  accessToken: "",
  template: "",
  language: "ar",
  params: [],
};

const toForm = (s) =>
  s
    ? {
        phoneNumberId: s.phoneNumberId || "",
        wabaId: s.wabaId || "",
        accessToken: "",
        template: s.template || "",
        language: s.language || "ar",
        params: (s.params || []).map((key) => ({ key })),
      }
    : EMPTY;

const reasonOf = (error) =>
  error?.result?.error || "حدث خطأ ما. حاول مرة أخرى.";

/**
 * WhatsApp settings for this merchant: their own Cloud API number, token
 * and approved template. The token is write-only: after saving, only its
 * last 4 characters are shown. Saving checks the number + token with Meta.
 */
export default function WhatsAppSettingsModal({
  getToken,
  onClose,
  showToast,
}) {
  const query = useWhatsAppSettings(getToken);
  const { save, remove, sendTest } = useWhatsAppSettingsMutations(getToken);
  const saved = query.data?.settings || null;
  const [testTo, setTestTo] = useState("");
  // Disconnect deletes the saved token, so it takes a second click.
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { register, control, handleSubmit, reset, setError, formState } = form;
  const { errors } = formState;
  const params = useFieldArray({ control, name: "params" });

  useEffect(() => {
    if (query.data) reset(toForm(query.data.settings));
  }, [query.data, reset]);

  const onSubmit = handleSubmit((values) => {
    if (!values.accessToken && !saved?.tokenLast4) {
      setError("accessToken", { message: "رمز الوصول مطلوب" });
      return;
    }
    save.mutate(
      { ...values, params: values.params.map((p) => p.key) },
      {
        onSuccess: () => showToast?.("تم حفظ إعدادات واتساب", "success"),
        onError: (error) => {
          const fields = error.result?.fields || {};
          Object.entries(fields).forEach(([name, messages]) =>
            setError(name, { message: [].concat(messages).join(" ") }),
          );
        },
      },
    );
  });

  let body;
  if (query.isPending) {
    body = <Skeleton height={200} />;
  } else if (query.isError) {
    body = (
      <Alert tone="error" title="تعذّر تحميل إعدادات واتساب">
        {reasonOf(query.error)}
      </Alert>
    );
  } else if (!query.data.storageReady) {
    body = (
      <Alert tone="warning" title="تخزين الإعدادات غير مفعّل بعد">
        يجب على مالك التطبيق إضافة Upstash Redis إلى مشروع Vercel وضبط{" "}
        <code dir="ltr">WA_SETTINGS_KEY</code>. إلى ذلك الحين يمكنك إرسال
        التذكيرات يدويًا فقط.
      </Alert>
    );
  } else {
    body = (
      <form className="wa-settings" onSubmit={onSubmit} noValidate>
        {saved?.profile && (
          <Alert tone="success" title="تم الربط">
            <CheckCircle2 size={14} aria-hidden="true" />{" "}
            {saved.profile.verifiedName || "واتساب للأعمال"} ·{" "}
            <span dir="ltr">{saved.profile.displayPhone}</span>
            {saved.profile.qualityRating &&
              ` · التقييم ${saved.profile.qualityRating}`}
          </Alert>
        )}

        {save.error && !Object.keys(save.error.result?.fields || {}).length && (
          <Alert tone="error" title="لم يتم الحفظ">
            <p>{reasonOf(save.error)}</p>
            {save.error.result?.detail && (
              <details>
                <summary>تفاصيل تقنية</summary>
                <pre className="wa-detail">{save.error.result.detail}</pre>
              </details>
            )}
          </Alert>
        )}

        <p className="form-hint">
          احصل على هذه البيانات من Meta: واتساب ← إعداد واجهة البرمجة (API
          Setup) في تطبيقك على developers.facebook.com. للاستخدام الفعلي أنشئ
          رمز وصول دائمًا لمستخدم النظام (System User) من إعدادات الأعمال.
        </p>

        <FormRow>
          <Field
            label="معرّف رقم الهاتف"
            required
            error={errors.phoneNumberId?.message}
          >
            <TextInput
              dir="ltr"
              inputMode="numeric"
              {...register("phoneNumberId")}
            />
          </Field>
          <Field
            label="معرّف حساب واتساب للأعمال"
            hint="اختياري"
            error={errors.wabaId?.message}
          >
            <TextInput dir="ltr" inputMode="numeric" {...register("wabaId")} />
          </Field>
        </FormRow>

        <Field
          label="رمز الوصول"
          required={!saved?.tokenLast4}
          hint={
            saved?.tokenLast4
              ? `محفوظ (ينتهي بـ ${saved.tokenLast4}). اتركه فارغًا للإبقاء عليه.`
              : "يُحفظ مشفّرًا ولا يظهر مرة أخرى بعد الحفظ."
          }
          error={errors.accessToken?.message}
        >
          <TextInput
            type="password"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            placeholder={saved?.tokenLast4 ? `••••${saved.tokenLast4}` : "EAA…"}
            {...register("accessToken")}
          />
        </Field>

        <FormRow>
          <Field
            label="اسم القالب"
            required
            hint="كما هو تمامًا في مدير واتساب (WhatsApp Manager)"
            error={errors.template?.message}
          >
            <TextInput
              dir="ltr"
              placeholder="cart_reminder_ar"
              {...register("template")}
            />
          </Field>
          <Field label="لغة القالب" required error={errors.language?.message}>
            <TextInput dir="ltr" placeholder="ar" {...register("language")} />
          </Field>
        </FormRow>

        <fieldset className="wa-params">
          <legend className="form-label">متغيرات القالب بالترتيب</legend>
          <p className="form-hint">
            ما الذي يوضع في <span dir="ltr">{"{{1}}"}</span>،{" "}
            <span dir="ltr">{"{{2}}"}</span>… داخل نص القالب. اتركها فارغة إذا
            كان القالب بلا متغيرات.
          </p>
          {params.fields.map((field, index) => (
            <div key={field.id} className="wa-param-row">
              <span className="wa-param-slot">{`{{${index + 1}}}`}</span>
              <Select
                aria-label={`قيمة المتغير {{${index + 1}}}`}
                {...register(`params.${index}.key`)}
                placeholder="اختر…"
                options={TEMPLATE_VARIABLES.map((v) => ({
                  value: v.key,
                  label: v.label,
                }))}
              />
              <IconButton
                icon={X}
                label={`حذف المتغير {{${index + 1}}}`}
                size={14}
                onClick={() => params.remove(index)}
              />
            </div>
          ))}
          {errors.params && (
            <span className="form-error-msg">
              {errors.params.message || "اختر قيمة لكل متغير"}
            </span>
          )}
          <Button
            size="small"
            variant="ghost"
            icon={Plus}
            onClick={() => params.append({ key: "" })}
            disabled={params.fields.length >= 10}
          >
            إضافة متغير
          </Button>
        </fieldset>

        {saved && (
          <div className="wa-test">
            <Field
              label="رسالة تجريبية"
              hint="تستخدم بيانات تجريبية (Ahmed Ali، SAR 420). مع رقم الاختبار من Meta لا يستلمها إلا المستلمون الذين أضفتهم في Meta."
            >
              <div className="wa-test-row">
                <TextInput
                  type="tel"
                  dir="ltr"
                  placeholder="+966500000000"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                />
                <Button
                  size="small"
                  icon={Send}
                  loading={sendTest.isPending}
                  disabled={!testTo.trim()}
                  onClick={() =>
                    sendTest.mutate(testTo, {
                      onSuccess: () =>
                        showToast?.("قبلت Meta الرسالة التجريبية", "success"),
                    })
                  }
                >
                  إرسال رسالة تجريبية
                </Button>
              </div>
            </Field>
            {sendTest.error && (
              <p className="cart-row-error" role="alert">
                {reasonOf(sendTest.error)}
              </p>
            )}
          </div>
        )}
      </form>
    );
  }

  const ready = query.data?.storageReady;
  return (
    <Modal
      isOpen
      onClose={onClose}
      dismissible={!save.isPending}
      icon={Settings2}
      title="إعدادات واتساب"
      subtitle="اربط حساب واتساب للأعمال الخاص بك"
      size="lg"
      footer={
        <>
          {saved && (
            <Button
              variant={confirmDisconnect ? "danger" : "ghost"}
              icon={Trash2}
              loading={remove.isPending}
              onClick={() => {
                if (!confirmDisconnect) {
                  setConfirmDisconnect(true);
                  return;
                }
                remove.mutate(undefined, {
                  onSuccess: () => {
                    showToast?.("تم فصل ربط واتساب", "success");
                    onClose();
                  },
                });
              }}
            >
              {confirmDisconnect ? "حذف الإعدادات المحفوظة؟" : "فصل الربط"}
            </Button>
          )}
          <Button onClick={onClose} disabled={save.isPending}>
            إغلاق
          </Button>
          {ready && (
            <Button
              variant="primary"
              onClick={onSubmit}
              loading={save.isPending}
            >
              {save.isPending ? "جارٍ التحقق مع Meta…" : "حفظ"}
            </Button>
          )}
        </>
      }
    >
      {body}
    </Modal>
  );
}
