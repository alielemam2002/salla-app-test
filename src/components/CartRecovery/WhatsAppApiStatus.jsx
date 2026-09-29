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
      {connected || tokenUnreadable ? "WhatsApp settings" : "Connect WhatsApp"}
    </Button>
  );

  if (tokenUnreadable) {
    return (
      <Alert
        tone="warning"
        title="Enter your WhatsApp token again"
        action={settingsButton}
      >
        The saved token can&apos;t be read anymore. Until you paste it again in
        WhatsApp settings, reminders can only be sent manually.
      </Alert>
    );
  }

  if (!connected) {
    return (
      <Alert tone="info" title="Manual sending only" action={settingsButton}>
        {storageReady
          ? "Use the WhatsApp button to send each reminder yourself. Connect your WhatsApp Business account to send them from the app."
          : "Use the WhatsApp button to send each reminder yourself. Sending from the app needs settings storage on the server first (Upstash Redis + WA_SETTINGS_KEY)."}
      </Alert>
    );
  }

  return (
    <Alert
      tone={enabled && !invalidParams.length ? "success" : "info"}
      title={`WhatsApp connected${profile?.verifiedName ? `: ${profile.verifiedName}` : ""}`}
      action={settingsButton}
    >
      <Switch
        label="Send from the app"
        description={
          enabled
            ? "The Send buttons use your WhatsApp Business account."
            : "Off: only manual sending (the WhatsApp button)."
        }
        checked={enabled}
        disabled={toggling}
        onChange={onToggle}
      />
      <p>
        {profile?.displayPhone && (
          <>
            From <span dir="ltr">{profile.displayPhone}</span> ·{" "}
          </>
        )}
        Template <code>{template}</code> ({language})
        {params.length
          ? ` with variables: ${params.join(", ")}.`
          : " with no variables."}
      </p>
      {!params.length && (
        <p>
          This template doesn&apos;t include the cart link. Use an approved
          template with variables for real reminders.
        </p>
      )}
      {invalidParams.length > 0 && (
        <p>Unknown template variables: {invalidParams.join(", ")}</p>
      )}
      {enabled && (
        <p>
          &quot;Sent&quot; means Meta accepted the message; delivery and read
          status need Meta&apos;s webhook (stage 2).
        </p>
      )}
    </Alert>
  );
}
