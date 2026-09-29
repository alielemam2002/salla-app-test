import { Settings2 } from "lucide-react";
import { Alert, Button } from "../ui/index.js";

/**
 * Which WhatsApp account the "Send" buttons use: the merchant's own
 * (WhatsApp settings), the server default (META_WA_* env, for testing), or
 * none. Never shows anything secret (the server doesn't return it).
 */
export default function WhatsAppApiStatus({ status, onOpenSettings }) {
  if (status.isPending || status.isError) return null;
  const {
    configured,
    source,
    template,
    language,
    params = [],
    invalidParams = [],
    profile,
    storageReady,
    tokenUnreadable,
  } = status.data;

  // Always offered: when storage isn't set up, the dialog explains what the
  // app owner has to add in Vercel.
  const settingsButton = (
    <Button size="small" icon={Settings2} onClick={onOpenSettings}>
      {source === "merchant" ? "WhatsApp settings" : "Connect WhatsApp"}
    </Button>
  );

  if (tokenUnreadable) {
    return (
      <Alert
        tone="warning"
        title="Enter your WhatsApp token again"
        action={settingsButton}
      >
        The saved token can&apos;t be read anymore. Open WhatsApp settings and
        paste it again.
      </Alert>
    );
  }

  if (!configured) {
    return (
      <Alert
        tone="info"
        title="WhatsApp API not connected"
        action={settingsButton}
      >
        {storageReady
          ? "Connect your WhatsApp Business account to send reminders from the app instead of opening WhatsApp."
          : "Settings storage isn't set up on the server yet (Upstash Redis + WA_SETTINGS_KEY)."}
      </Alert>
    );
  }

  const title =
    source === "merchant"
      ? `WhatsApp connected${profile?.verifiedName ? `: ${profile.verifiedName}` : ""}`
      : "WhatsApp connected (server default account)";

  return (
    <Alert
      tone={invalidParams.length ? "warning" : "success"}
      title={title}
      action={settingsButton}
    >
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
      {source === "server" && (
        <p>
          This is the app&apos;s shared test account. Connect your own WhatsApp
          Business account to send from your number
          {storageReady
            ? "."
            : " (first the app owner adds Upstash Redis and WA_SETTINGS_KEY in Vercel)."}
        </p>
      )}
      {!params.length && (
        <p>
          This template doesn&apos;t include the cart link. Use an approved
          template with variables for real reminders.
        </p>
      )}
      {invalidParams.length > 0 && (
        <p>Unknown template variables: {invalidParams.join(", ")}</p>
      )}
      <p>
        &quot;Sent&quot; means Meta accepted the message; delivery and read
        status need Meta&apos;s webhook (stage 2).
      </p>
    </Alert>
  );
}
