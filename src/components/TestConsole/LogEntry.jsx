import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { cx } from "../ui/cx.js";
import { formatLogData, formatLogTime } from "../../utils/testConsoleFormat.js";

/** A single message-log row; long payloads expand on click. */
export default function LogEntry({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const { full, preview, isTruncated } = formatLogData(entry.data);
  const outgoing = entry.direction === "outgoing";
  const DirectionIcon = outgoing ? ArrowUpRight : ArrowDownLeft;

  const row = (
    <>
      <span className="log-time">{formatLogTime(entry.time)}</span>
      <span
        className={cx("log-direction", entry.direction)}
        title={outgoing ? "Sent to host" : "Received from host"}
      >
        <DirectionIcon size={12} aria-hidden="true" />
        <span className="sr-only">{outgoing ? "Outgoing" : "Incoming"}</span>
      </span>
      <span className="log-event">{entry.event.replace("embedded::", "")}</span>
      <span className="log-data">{preview}</span>
      {isTruncated && (
        <ChevronRight
          size={14}
          className={cx("log-chevron", expanded && "is-open")}
          aria-hidden="true"
        />
      )}
    </>
  );

  return (
    <li
      className={cx(
        "log-entry",
        expanded && "log-entry-expanded",
        entry.error && "log-entry-error",
      )}
      data-event={entry.event}
    >
      {isTruncated ? (
        <button
          type="button"
          className="log-entry-row log-entry-row--button"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {row}
        </button>
      ) : (
        <div className="log-entry-row">{row}</div>
      )}
      {entry.error && <div className="log-error">⚠ {entry.error}</div>}
      {expanded && <pre className="log-data-full">{full}</pre>}
    </li>
  );
}
