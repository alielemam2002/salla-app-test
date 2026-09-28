import { Braces, FileCode2, Send } from "lucide-react";
import { Alert, Button, Card } from "../ui/index.js";
import { usePayloadEditor } from "../../hooks/testConsole/usePayloadEditor.js";

/** Raw JSON editor for sending custom postMessage payloads to the host. */
export default function PayloadEditor({
  onSend,
  initialPayload = "",
  eventPayload = null,
}) {
  const { text, setText, error, send, format } = usePayloadEditor({
    onSend,
    initialPayload,
    eventPayload,
  });

  return (
    <Card className="console-editor">
      <Card.Header
        icon={FileCode2}
        title="Payload Editor"
        subtitle="Customize event data"
        actions={
          <>
            <Button size="small" variant="ghost" icon={Braces} onClick={format}>
              Format
            </Button>
            <Button size="small" variant="primary" icon={Send} onClick={send}>
              Send
            </Button>
          </>
        }
      />
      <Card.Body className="console-editor-body">
        <textarea
          className="payload-textarea"
          aria-label="Payload JSON"
          spellCheck="false"
          value={text}
          aria-invalid={error ? true : undefined}
          onChange={(e) => setText(e.target.value)}
        />
        {error && <Alert tone="error">{error}</Alert>}
        <p className="console-editor-note">
          Debug only: sends a raw postMessage. Real apps should call SDK
          methods.
        </p>
      </Card.Body>
    </Card>
  );
}
