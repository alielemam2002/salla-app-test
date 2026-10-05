import { Settings } from "lucide-react";
import { Alert, Button, Field, Select, TextInput } from "../ui/index.js";
import {
  CUSTOM_SOURCE,
  defaultSlots,
  previewText,
  slotKey,
  slotLabel,
  templateSlots,
} from "../../utils/whatsapp/templateBinding.js";
import { TEMPLATE_CATEGORY } from "../../utils/settings/settingsLabels.js";

/**
 * Pick one of the merchant's approved templates (Settings → library read
 * from Meta) and what fills each of its variables. Controlled: `value` is
 * { templateId, slots }; `onChange` gets the next value. `sources` are the
 * feature's values ([{ key, label }]); "fixed text" is always offered.
 * The server re-checks the choice against the library.
 */
export default function TemplatePicker({
  templates = [],
  value,
  onChange,
  sources,
  onOpenSettings,
  disabled,
  label = "القالب",
}) {
  const approved = templates.filter((t) => t.status === "APPROVED");
  const template = approved.find((t) => t.id === value?.templateId) || null;

  if (!approved.length) {
    return (
      <Alert
        tone="info"
        title="لا توجد قوالب معتمدة بعد"
        action={
          onOpenSettings && (
            <Button size="small" icon={Settings} onClick={onOpenSettings}>
              الإعدادات
            </Button>
          )
        }
      >
        اربط حساب واتساب وحدّث قوالبك من تبويب «الإعدادات»، ثم اختر القالب هنا.
      </Alert>
    );
  }

  const chosen = new Map((value?.slots || []).map((s) => [slotKey(s), s]));
  const slots = template
    ? templateSlots(template).map((slot) => ({
        ...slot,
        source: chosen.get(slotKey(slot))?.source || "",
        value: chosen.get(slotKey(slot))?.value || "",
      }))
    : [];
  const setSlot = (index, patch) =>
    onChange({
      templateId: template.id,
      slots: slots.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    });
  const preview = template ? previewText(template, slots, sources) : null;
  const options = [
    ...sources.map((s) => ({ value: s.key, label: s.label })),
    { value: CUSTOM_SOURCE, label: "نص ثابت" },
  ];

  return (
    <div className="wa-picker">
      <Field label={label}>
        <Select
          value={template?.id || ""}
          disabled={disabled}
          placeholder="اختر قالبًا معتمدًا"
          onChange={(e) => {
            const next = approved.find((t) => t.id === e.target.value);
            onChange(
              next
                ? { templateId: next.id, slots: defaultSlots(next, sources) }
                : { templateId: "", slots: [] },
            );
          }}
          options={approved.map((t) => ({
            value: t.id,
            label: `${t.name} · ${t.language} · ${TEMPLATE_CATEGORY[t.category] || t.category}`,
          }))}
        />
      </Field>

      {template && (
        <>
          <div className="wa-picker-preview" dir="auto">
            {preview.header && <strong>{preview.header}</strong>}
            <p>{preview.body}</p>
            {template.buttons.map((b, i) => (
              <span key={i} className="wa-picker-button">
                {b.text}
              </span>
            ))}
          </div>

          {slots.length ? (
            <div className="wa-picker-slots">
              {slots.map((slot, index) => (
                <div key={slotKey(slot)} className="wa-picker-slot">
                  <Field
                    label={slotLabel(slot)}
                    hint={
                      slot.part === "button"
                        ? `يُضاف بعد: ${String(slot.url || "").split("{{")[0]}`
                        : undefined
                    }
                  >
                    <Select
                      value={slot.source}
                      disabled={disabled}
                      placeholder="اختر ما يملأ المتغير"
                      onChange={(e) =>
                        setSlot(index, { source: e.target.value })
                      }
                      options={options}
                    />
                  </Field>
                  {slot.source === CUSTOM_SOURCE && (
                    <TextInput
                      aria-label={`نص ${slotLabel(slot)}`}
                      placeholder="اكتب النص"
                      maxLength={1000}
                      disabled={disabled}
                      value={slot.value}
                      onChange={(e) =>
                        setSlot(index, { value: e.target.value })
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="form-hint">هذا القالب بلا متغيرات.</p>
          )}
        </>
      )}
    </div>
  );
}
