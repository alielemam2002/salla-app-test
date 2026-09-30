import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, MessageCircle, Unplug } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Field,
  FormRow,
  Skeleton,
  Switch,
  TextInput,
} from "../ui/index.js";

const ID = /^\d{5,25}$/;

const schema = z.object({
  phoneNumberId: z
    .string()
    .trim()
    .regex(ID, "استخدم معرّف رقم الهاتف (أرقام فقط)"),
  wabaId: z.string().trim().regex(ID, "معرّف حساب واتساب للأعمال (أرقام فقط)"),
  accessToken: z.string().trim(),
});

const toForm = (s) => ({
  phoneNumberId: s?.phoneNumberId || "",
  wabaId: s?.wabaId || "",
  accessToken: "",
});

/**
 * The merchant's own WhatsApp Business account, entered once for every
 * feature. The token is write-only: after saving only its last 4
 * characters are shown. Saving checks the number + token with Meta, then
 * reads the account's templates.
 */
export default function WhatsAppAccountCard({
  query,
  saveAccount,
  toggle,
  remove,
  onRemoved,
  showToast,
}) {
  const saved = query.data?.settings || null;
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [serverError, setServerError] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(schema), defaultValues: toForm(saved) });

  useEffect(() => {
    reset(toForm(saved));
  }, [saved, reset]);

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    if (!values.accessToken && !saved?.tokenLast4) {
      setError("accessToken", { message: "رمز الوصول مطلوب" });
      return;
    }
    saveAccount.mutate(values, {
      onSuccess: (result) => {
        showToast?.("تم حفظ حساب واتساب", "success");
        if (result.templatesError) {
          showToast?.(
            `لم نتمكن من قراءة القوالب: ${result.templatesError}`,
            "warning",
          );
        }
      },
      onError: (error) => {
        const result = error.result || {};
        Object.entries(result.fields || {}).forEach(([name, [message]]) =>
          setError(name, { message }),
        );
        setServerError(result.error || "تعذّر حفظ الحساب");
      },
    });
  });

  let content;
  if (query.isPending) {
    content = <Skeleton height={140} />;
  } else if (query.isError) {
    content = (
      <Alert tone="error">
        {query.error.result?.error || "تعذّر تحميل إعدادات واتساب"}
      </Alert>
    );
  } else if (!query.data.storageReady) {
    content = (
      <Alert tone="warning" title="التخزين غير مفعّل على الخادم">
        فعّل Upstash Redis و WA_SETTINGS_KEY في Vercel لحفظ إعدادات واتساب.
      </Alert>
    );
  } else {
    content = (
      <>
        {saved?.profile && (
          <Alert tone={saved.enabled ? "success" : "info"} title="الحساب مربوط">
            <p>
              {saved.profile.verifiedName}
              {saved.profile.displayPhone && (
                <>
                  {" · "}
                  <span dir="ltr">{saved.profile.displayPhone}</span>
                </>
              )}
              {saved.profile.qualityRating && (
                <> · تقييم الجودة: {saved.profile.qualityRating}</>
              )}
            </p>
            <Switch
              label="الإرسال من التطبيق"
              description={
                saved.enabled
                  ? "كل الميزات ترسل من هذا الحساب."
                  : "متوقف: الإرسال اليدوي فقط."
              }
              checked={saved.enabled}
              disabled={toggle.isPending}
              onChange={(enabled) =>
                toggle.mutate(enabled, {
                  onError: (error) =>
                    showToast?.(
                      error.result?.error || "تعذّر تغيير الإعداد",
                      "error",
                    ),
                })
              }
            />
          </Alert>
        )}

        <form className="settings-form" onSubmit={onSubmit} noValidate>
          <FormRow columns={2}>
            <Field
              label="معرّف رقم الهاتف (Phone Number ID)"
              error={errors.phoneNumberId?.message}
            >
              <TextInput
                dir="ltr"
                inputMode="numeric"
                {...register("phoneNumberId")}
              />
            </Field>
            <Field
              label="معرّف حساب واتساب للأعمال (WABA ID)"
              error={errors.wabaId?.message}
              hint="مطلوب لعرض قوالبك."
            >
              <TextInput
                dir="ltr"
                inputMode="numeric"
                {...register("wabaId")}
              />
            </Field>
          </FormRow>
          <Field
            label="رمز الوصول الدائم (System User token)"
            error={errors.accessToken?.message}
            hint={
              saved?.tokenLast4
                ? `محفوظ وينتهي بـ ${saved.tokenLast4}. اتركه فارغًا للإبقاء عليه.`
                : "يحتاج صلاحيتي whatsapp_business_messaging و whatsapp_business_management."
            }
          >
            <TextInput
              dir="ltr"
              type="password"
              autoComplete="off"
              placeholder={saved?.tokenLast4 ? `•••• ${saved.tokenLast4}` : ""}
              {...register("accessToken")}
            />
          </Field>
          <p className="form-hint">
            تجد المعرّفين في Meta for Developers ← تطبيقك ← WhatsApp ← API
            Setup. الرمز الدائم من إعدادات النشاط التجاري ← مستخدمو النظام.
          </p>
          {serverError && <Alert tone="error">{serverError}</Alert>}
          <div className="settings-actions">
            <Button
              type="submit"
              variant="primary"
              icon={CheckCircle2}
              loading={saveAccount.isPending}
              disabled={saved?.tokenLast4 ? !isDirty : false}
            >
              {saved ? "حفظ التغييرات" : "ربط الحساب"}
            </Button>
            {saved && (
              <Button
                variant="ghost"
                icon={Unplug}
                onClick={() => setConfirmRemove(true)}
              >
                فصل الحساب
              </Button>
            )}
          </div>
        </form>
      </>
    );
  }

  return (
    <Card>
      <Card.Header
        icon={MessageCircle}
        title="حساب واتساب للأعمال"
        subtitle="تضيفه مرة واحدة، وتستخدمه كل الميزات: السلات المتروكة والحملات وإعادة الشراء."
      />
      <div className="settings-body">{content}</div>
      <ConfirmDialog
        isOpen={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          remove.mutate(undefined, {
            onSuccess: () => {
              onRemoved?.();
              showToast?.("تم فصل حساب واتساب", "success");
            },
          });
        }}
        tone="danger"
        title="فصل حساب واتساب؟"
        confirmText="فصل الحساب"
        cancelText="إلغاء"
      >
        <p>
          سيُحذف رمز الوصول والقوالب المحفوظة، ويتوقف الإرسال من التطبيق حتى
          تربط الحساب مرة أخرى.
        </p>
      </ConfirmDialog>
    </Card>
  );
}
