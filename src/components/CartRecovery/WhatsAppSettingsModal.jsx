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
  phoneNumberId: z.string().trim().regex(ID, "Use the numeric Phone Number ID"),
  wabaId: z
    .string()
    .trim()
    .refine((v) => !v || ID.test(v), "Use the numeric account ID"),
  accessToken: z.string().trim(),
  template: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,512}$/, "Lowercase letters, numbers and _ only"),
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, "A language code like ar or en_US"),
  params: z
    .array(z.object({ key: z.string().min(1, "Choose a value") }))
    .max(10),
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
  error?.result?.error || "Something went wrong. Try again.";

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
      setError("accessToken", { message: "An access token is required" });
      return;
    }
    save.mutate(
      { ...values, params: values.params.map((p) => p.key) },
      {
        onSuccess: () => showToast?.("WhatsApp settings saved", "success"),
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
      <Alert tone="error" title="Could not load WhatsApp settings.">
        {reasonOf(query.error)}
      </Alert>
    );
  } else if (!query.data.storageReady) {
    body = (
      <Alert tone="warning" title="Settings storage isn't set up yet.">
        The app owner needs to add Upstash Redis to the Vercel project and set
        <code> WA_SETTINGS_KEY</code>. Until then, reminders can only be sent
        manually.
      </Alert>
    );
  } else {
    body = (
      <form className="wa-settings" onSubmit={onSubmit} noValidate>
        {saved?.profile && (
          <Alert tone="success" title="Connected">
            <CheckCircle2 size={14} aria-hidden="true" />{" "}
            {saved.profile.verifiedName || "WhatsApp Business"} ·{" "}
            <span dir="ltr">{saved.profile.displayPhone}</span>
            {saved.profile.qualityRating &&
              ` · quality ${saved.profile.qualityRating}`}
          </Alert>
        )}

        {save.error && !Object.keys(save.error.result?.fields || {}).length && (
          <Alert tone="error" title="Not saved.">
            <p>{reasonOf(save.error)}</p>
            {save.error.result?.detail && (
              <details>
                <summary>Technical details</summary>
                <pre className="wa-detail">{save.error.result.detail}</pre>
              </details>
            )}
          </Alert>
        )}

        <p className="form-hint">
          From Meta: WhatsApp → API Setup (or API Testing) in your app on
          developers.facebook.com. For real use, create a permanent System User
          token in Business Settings.
        </p>

        <FormRow>
          <Field
            label="Phone Number ID"
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
            label="WhatsApp Business Account ID"
            hint="Optional"
            error={errors.wabaId?.message}
          >
            <TextInput dir="ltr" inputMode="numeric" {...register("wabaId")} />
          </Field>
        </FormRow>

        <Field
          label="Access token"
          required={!saved?.tokenLast4}
          hint={
            saved?.tokenLast4
              ? `Saved (ends in ${saved.tokenLast4}). Leave empty to keep it.`
              : "Stored encrypted. It's never shown again after saving."
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
            label="Template name"
            required
            hint="Exactly as approved in WhatsApp Manager"
            error={errors.template?.message}
          >
            <TextInput
              dir="ltr"
              placeholder="cart_reminder_ar"
              {...register("template")}
            />
          </Field>
          <Field
            label="Template language"
            required
            error={errors.language?.message}
          >
            <TextInput dir="ltr" placeholder="ar" {...register("language")} />
          </Field>
        </FormRow>

        <fieldset className="wa-params">
          <legend className="form-label">Template variables, in order</legend>
          <p className="form-hint">
            What to put in {"{{1}}"}, {"{{2}}"}… of the template&apos;s body.
            Leave empty for a template without variables.
          </p>
          {params.fields.map((field, index) => (
            <div key={field.id} className="wa-param-row">
              <span className="wa-param-slot">{`{{${index + 1}}}`}</span>
              <Select
                aria-label={`Value for {{${index + 1}}}`}
                {...register(`params.${index}.key`)}
                placeholder="Choose…"
                options={TEMPLATE_VARIABLES.map((v) => ({
                  value: v.key,
                  label: v.label,
                }))}
              />
              <IconButton
                icon={X}
                label={`Remove {{${index + 1}}}`}
                size={14}
                onClick={() => params.remove(index)}
              />
            </div>
          ))}
          {errors.params && (
            <span className="form-error-msg">
              {errors.params.message || "Choose a value for every variable"}
            </span>
          )}
          <Button
            size="small"
            variant="ghost"
            icon={Plus}
            onClick={() => params.append({ key: "" })}
            disabled={params.fields.length >= 10}
          >
            Add variable
          </Button>
        </fieldset>

        {saved && (
          <div className="wa-test">
            <Field
              label="Send a test message"
              hint="Uses sample data (Ahmed, SAR 420). With Meta's test number, only verified recipients receive it."
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
                        showToast?.(
                          "Meta accepted the test message",
                          "success",
                        ),
                    })
                  }
                >
                  Send test
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
      title="WhatsApp settings"
      subtitle="Connect your own WhatsApp Business account"
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
                    showToast?.("WhatsApp disconnected", "success");
                    onClose();
                  },
                });
              }}
            >
              {confirmDisconnect ? "Delete saved settings?" : "Disconnect"}
            </Button>
          )}
          <Button onClick={onClose} disabled={save.isPending}>
            Close
          </Button>
          {ready && (
            <Button
              variant="primary"
              onClick={onSubmit}
              loading={save.isPending}
            >
              {save.isPending ? "Checking with Meta…" : "Save"}
            </Button>
          )}
        </>
      }
    >
      {body}
    </Modal>
  );
}
