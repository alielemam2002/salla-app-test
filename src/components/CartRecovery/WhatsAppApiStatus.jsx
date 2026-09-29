import { Alert } from "../ui/index.js";

/**
 * Whether the WhatsApp Cloud API is set up on the server. Shows the
 * template in use; never anything secret (the server doesn't return it).
 */
export default function WhatsAppApiStatus({ status }) {
  if (status.isPending || status.isError) return null;
  const {
    configured,
    template,
    language,
    params = [],
    invalidParams = [],
  } = status.data;

  if (!configured) {
    return (
      <Alert tone="info" title="WhatsApp API not connected">
        To send from the app instead of opening WhatsApp, add{" "}
        <code>META_WA_TOKEN</code> and <code>META_WA_PHONE_NUMBER_ID</code> in
        Vercel and redeploy.
      </Alert>
    );
  }

  return (
    <Alert
      tone={invalidParams.length ? "warning" : "success"}
      title="WhatsApp API connected"
    >
      <p>
        Template <code>{template}</code> ({language})
        {params.length
          ? ` with variables: ${params.join(", ")}.`
          : " with no variables."}
      </p>
      {!params.length && (
        <p>
          This template doesn&apos;t include the cart link. For real reminders,
          create an approved template with variables and set{" "}
          <code>META_WA_TEMPLATE_NAME</code> and{" "}
          <code>META_WA_TEMPLATE_PARAMS</code>.
        </p>
      )}
      {invalidParams.length > 0 && (
        <p>
          Unknown variables in META_WA_TEMPLATE_PARAMS:{" "}
          {invalidParams.join(", ")}
        </p>
      )}
      <p>
        &quot;Sent&quot; means Meta accepted the message; delivery and read
        status need Meta&apos;s webhook (stage 2).
      </p>
    </Alert>
  );
}
