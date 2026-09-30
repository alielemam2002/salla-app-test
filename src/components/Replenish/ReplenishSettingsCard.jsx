import { useState } from "react";
import { Copy, MessageCircle, Repeat, RotateCcw, Send } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  FormRow,
  IconButton,
  SegmentedTabs,
  Select,
  Switch,
  TextInput,
  Textarea,
} from "../ui/index.js";
import {
  DAILY_LIMIT_OPTIONS,
  DEFAULT_REPLENISH_TEXT,
  LEAD_OPTIONS,
  REPLENISH_VARIABLES,
  SAMPLE_TEMPLATE_AR,
  SCHEDULE_LABEL,
} from "../../utils/replenish/replenishModel.js";
import { timeAgo } from "../../utils/cartRecovery/cartModel.js";

const SLOTS = 4;

const draftOf = (s) => ({
  template: s.template || "",
  language: s.language || "ar",
  params: s.params || [],
  leadDays: s.leadDays,
  dailyLimit: s.dailyLimit,
  couponCode: s.couponCode || "",
  customMessage: s.customMessage || "",
});

const toOptions = (options) =>
  options.map((o) => ({ value: String(o.value), label: o.label }));

function LastRun({ run }) {
  return (
    <p className="form-hint" aria-live="polite">
      آخر تشغيل {timeAgo(Date.parse(run.at))}: أُرسل {run.sent || 0}، فشل{" "}
      {run.failed || 0}
      {run.remaining ? `، مؤجل ${run.remaining}` : ""}.
      {run.stopped && ` توقف: ${run.stopped.message}`}
    </p>
  );
}

/**
 * The replenish template, lead time, daily cap, coupon and the switch for
 * the daily automatic run. The switch saves right away (with the other
 * fields); "Save" saves the fields.
 */
export default function ReplenishSettingsCard({
  data,
  save,
  sendTest,
  coupons,
  onCopy,
  showToast,
}) {
  const { settings: saved, blockers = [], sentToday = 0, whatsapp } = data;
  const [draft, setDraft] = useState(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [testTo, setTestTo] = useState("");
  const [messageMode, setMessageMode] = useState(
    saved.template ? "template" : "text",
  );

  const values = draft || draftOf(saved);
  const dirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(draftOf(saved));
  const needsConsent = !saved.consentAt;
  const set = (name, value) => setDraft({ ...values, [name]: value });
  const setSlot = (index, key) => {
    const slots = Array.from(
      { length: SLOTS },
      (_, i) => values.params[i] || "",
    );
    slots[index] = key;
    // Variables are {{1}}, {{2}}… in order: stop at the first empty slot.
    const params = [];
    for (const slot of slots) {
      if (!slot) break;
      params.push(slot);
    }
    set("params", params);
  };

  const submit = (enabled) => {
    setError(null);
    setFieldErrors({});
    if (enabled && needsConsent && !consent) {
      setError("أكّد أولًا أن عملاءك وافقوا على استلام رسائل واتساب من متجرك.");
      return;
    }
    const payload = {
      ...values,
      enabled,
      ...(consent ? { consent: true } : {}),
    };
    if (!payload.customMessage?.trim()) {
      delete payload.customMessage;
    }
    save.mutate(payload, {
      onSuccess: () => {
        setDraft(null);
        showToast?.(
          enabled === saved.enabled
            ? "تم حفظ الإعدادات"
            : enabled
              ? "تم تفعيل التذكير التلقائي"
              : "تم إيقاف التذكير التلقائي",
          "success",
        );
      },
      onError: (e) => {
        setError(e.result?.error || "تعذّر حفظ الإعدادات");
        setFieldErrors(e.result?.fields || {});
      },
    });
  };

  const test = () =>
    sendTest.mutate(testTo, {
      onSuccess: () => showToast?.("قبلت Meta رسالة التجربة", "success"),
      onError: (e) =>
        showToast?.(e.result?.error || "تعذّر إرسال التجربة", "error"),
    });

  const visibleBlockers = blockers.filter((b) => {
    if (messageMode === "text") {
      return !b.includes("القالب") && !b.includes("template");
    }
    return true;
  });

  return (
    <Card>
      <Card.Header
        icon={Repeat}
        title="تذكير إعادة الشراء"
        subtitle="قبل أن ينفد المنتج عند العميل، نذكّره على واتساب برابط المنتج."
        actions={
          <Badge tone={saved.enabled ? "success" : "neutral"} dot>
            {saved.enabled ? "مفعّل" : "متوقف"}
          </Badge>
        }
      />
      <div className="replenish-body">
        <div style={{ marginBottom: "16px" }}>
          <SegmentedTabs
            tabs={[
              {
                id: "text",
                label: "رسالة نصية مباشرة (عبر واتساب بدون قوالب)",
                icon: MessageCircle,
              },
              {
                id: "template",
                label: "قالب رسمي معتمد (Meta Cloud API)",
                icon: Repeat,
              },
            ]}
            activeTab={messageMode}
            onTabChange={setMessageMode}
            variant="pill"
            ariaLabel="طريقة إرسال التذكيرات"
          />
        </div>

        <Switch
          label="إرسال التذكيرات تلقائيًا"
          description={
            messageMode === "text"
              ? "تجهيز التذكيرات وجدولتها لمنتجات المتجر لمراسلة العملاء قبل نفاد المنتج."
              : `${SCHEDULE_LABEL}. يُرسل القالب المعتمد فقط، مرة لكل منتج اشتراه العميل.`
          }
          checked={saved.enabled}
          disabled={
            save.isPending || (!saved.enabled && visibleBlockers.length > 0)
          }
          onChange={submit}
        />

        {visibleBlockers.length > 0 && (
          <Alert tone="warning" title="لا يمكن التشغيل التلقائي بعد">
            <ul className="replenish-list">
              {visibleBlockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </Alert>
        )}

        {messageMode === "template" && (
          <>
            <details className="replenish-sample">
              <summary>القالب المقترح لتسجيله في Meta (فئة Marketing)</summary>
              <div className="replenish-sample-box">
                <pre dir="rtl">{SAMPLE_TEMPLATE_AR}</pre>
                <IconButton
                  icon={Copy}
                  label="نسخ نص القالب"
                  size={14}
                  onClick={() => onCopy(SAMPLE_TEMPLATE_AR)}
                />
              </div>
              <p className="form-hint">
                المتغيرات بالترتيب: اسم العميل، اسم المنتج، رابط المنتج. بعد
                اعتماده اكتب اسمه هنا.
              </p>
            </details>

            <FormRow columns={2}>
              <Field
                label="اسم القالب المعتمد"
                error={fieldErrors.template?.[0]}
              >
                <TextInput
                  dir="ltr"
                  placeholder="replenish_reminder"
                  value={values.template}
                  onChange={(e) => set("template", e.target.value)}
                />
              </Field>
              <Field label="لغة القالب" error={fieldErrors.language?.[0]}>
                <TextInput
                  dir="ltr"
                  value={values.language}
                  onChange={(e) => set("language", e.target.value)}
                />
              </Field>
            </FormRow>

            <div className="replenish-slots">
              {Array.from({ length: SLOTS }, (_, i) => (
                <Field key={i} label={`المتغير {{${i + 1}}}`}>
                  <Select
                    value={values.params[i] || ""}
                    disabled={i > values.params.length}
                    onChange={(e) => setSlot(i, e.target.value)}
                    placeholder="—"
                    options={REPLENISH_VARIABLES.map((v) => ({
                      value: v.key,
                      label: v.label,
                    }))}
                  />
                </Field>
              ))}
            </div>

            <FormRow columns={3}>
              <Field label="موعد التذكير">
                <Select
                  value={String(values.leadDays)}
                  onChange={(e) => set("leadDays", Number(e.target.value))}
                  options={toOptions(LEAD_OPTIONS)}
                />
              </Field>
              <Field label="الحد الأقصى في اليوم">
                <Select
                  value={String(values.dailyLimit)}
                  onChange={(e) => set("dailyLimit", Number(e.target.value))}
                  options={toOptions(DAILY_LIMIT_OPTIONS)}
                />
              </Field>
              <Field label="كوبون (إن كان في القالب)">
                <Select
                  value={values.couponCode}
                  onChange={(e) => set("couponCode", e.target.value)}
                  placeholder="بدون كوبون"
                  options={coupons.map((c) => ({
                    value: c.code,
                    label: c.code,
                  }))}
                />
              </Field>
            </FormRow>
          </>
        )}

        {messageMode === "text" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <Field
              label="نص رسالة الواتساب المباشرة"
              hint="اكتب رسالة التذكير التي ستظهر تلقائيًا عند مراسلة العميل عبر واتساب برابط المنتج."
              error={fieldErrors.customMessage?.[0]}
            >
              <Textarea
                rows={4}
                value={values.customMessage}
                placeholder={DEFAULT_REPLENISH_TEXT}
                onChange={(e) => set("customMessage", e.target.value)}
              />
            </Field>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                alignItems: "center",
              }}
            >
              <span
                style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}
              >
                إدراج متغير:
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                style={{ fontSize: "0.76rem", padding: "2px 8px" }}
                onClick={() =>
                  set(
                    "customMessage",
                    `${values.customMessage || DEFAULT_REPLENISH_TEXT} {{customer_name}} `,
                  )
                }
              >
                + اسم العميل
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                style={{ fontSize: "0.76rem", padding: "2px 8px" }}
                onClick={() =>
                  set(
                    "customMessage",
                    `${values.customMessage || DEFAULT_REPLENISH_TEXT} {{product_name}} `,
                  )
                }
              >
                + اسم المنتج
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                style={{ fontSize: "0.76rem", padding: "2px 8px" }}
                onClick={() =>
                  set(
                    "customMessage",
                    `${values.customMessage || DEFAULT_REPLENISH_TEXT} {{product_url}} `,
                  )
                }
              >
                + رابط المنتج
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                style={{ fontSize: "0.76rem", padding: "2px 8px" }}
                onClick={() =>
                  set(
                    "customMessage",
                    `${values.customMessage || DEFAULT_REPLENISH_TEXT} {{coupon_code}} `,
                  )
                }
              >
                + كود الكوبون
              </button>
            </div>

            <FormRow columns={2}>
              <Field label="موعد التذكير قبل النفاد">
                <Select
                  value={String(values.leadDays)}
                  onChange={(e) => set("leadDays", Number(e.target.value))}
                  options={toOptions(LEAD_OPTIONS)}
                />
              </Field>
              <Field label="كوبون خصم تشجيعي (اختياري)">
                <Select
                  value={values.couponCode}
                  onChange={(e) => set("couponCode", e.target.value)}
                  placeholder="بدون كوبون"
                  options={coupons.map((c) => ({
                    value: c.code,
                    label: c.code,
                  }))}
                />
              </Field>
            </FormRow>
          </div>
        )}

        {needsConsent ? (
          <Checkbox
            label="أؤكد أن عملائي وافقوا على استلام رسائل واتساب من متجري، وسأوقف الرسائل لمن يطلب ذلك."
            checked={consent}
            onChange={setConsent}
          />
        ) : (
          <p className="form-hint">
            أكّدت موافقة العملاء {timeAgo(Date.parse(saved.consentAt))}.
          </p>
        )}

        {error && <Alert tone="error">{error}</Alert>}

        <div className="replenish-actions">
          <Button
            size="small"
            onClick={() => submit(saved.enabled)}
            disabled={!dirty}
            loading={save.isPending}
          >
            حفظ الإعدادات
          </Button>
          <span className="form-hint">
            أُرسل اليوم {sentToday} من {saved.dailyLimit}
          </span>
        </div>

        {saved.lastRun && <LastRun run={saved.lastRun} />}

        {whatsapp?.connected && saved.template && (
          <div className="replenish-test">
            <TextInput
              dir="ltr"
              aria-label="رقم لرسالة التجربة"
              placeholder="+9665XXXXXXXX"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
            <Button
              size="small"
              variant="secondary"
              icon={Send}
              onClick={test}
              loading={sendTest.isPending}
              disabled={!testTo.trim()}
            >
              إرسال تجربة
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
