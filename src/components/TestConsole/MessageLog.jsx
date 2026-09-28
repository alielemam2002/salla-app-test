import { useEffect, useRef } from "react";
import { Copy, MessageSquare, ScrollText, Trash2 } from "lucide-react";
import { Badge, Button, Card, Checkbox, EmptyState } from "../ui/index.js";
import LogEntry from "./LogEntry.jsx";

/** Real-time list of postMessage traffic. Presentational only. */
export default function MessageLog({
  messageLog,
  filterUnknown,
  onFilterChange,
  onClear,
  onCopy,
}) {
  const logContainerRef = useRef(null);

  useEffect(() => {
    // Auto-scroll to the newest message
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [messageLog]);

  const filteredLog = filterUnknown
    ? messageLog.filter((entry) => entry.event !== "unknown")
    : messageLog;

  return (
    <Card className="console-message-log">
      <Card.Header
        icon={ScrollText}
        title={
          <>
            Message Log <Badge tone="primary">{filteredLog.length}</Badge>
          </>
        }
        subtitle="Real-time event stream"
        actions={
          <>
            <Checkbox
              checked={filterUnknown}
              onChange={onFilterChange}
              label="Hide unknown"
            />
            <Button
              size="small"
              icon={Trash2}
              title="Clear Log"
              onClick={onClear}
            >
              Clear
            </Button>
            <Button size="small" icon={Copy} title="Copy Log" onClick={onCopy}>
              Copy
            </Button>
          </>
        }
      />
      <div
        ref={logContainerRef}
        className="log-container"
        aria-live="polite"
        aria-label="Message log"
      >
        {filteredLog.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description={`Click "Init + Verify" to start the bootstrap flow`}
            className="log-empty"
          />
        ) : (
          <ol className="log-list">
            {filteredLog.map((entry, i) => (
              <LogEntry key={`${entry.time}-${i}`} entry={entry} />
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
