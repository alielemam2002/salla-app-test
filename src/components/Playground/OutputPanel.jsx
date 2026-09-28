import { useState } from "react";
import { MessageSquare, Terminal, Trash2 } from "lucide-react";
import { Badge, Card, Checkbox, EmptyState, IconButton } from "../ui/index.js";
import { cx } from "../ui/cx.js";

const TYPE_ICONS = {
  log: "ℹ",
  error: "✗",
  warn: "⚠",
  info: "ℹ",
  debug: "🔍",
  result: "✓",
};

// Keep output on one line: compact valid JSON, leave anything else as-is.
function formatOutput(args) {
  try {
    return JSON.stringify(JSON.parse(args));
  } catch {
    return args;
  }
}

function OutputEntry({ type, args, showTypeLabel }) {
  return (
    <li className={cx("console-entry", `console-${type}`)}>
      {showTypeLabel && (
        <span className="console-type">
          {TYPE_ICONS[type] || "•"} {type}
        </span>
      )}
      <span className="console-data">{args}</span>
    </li>
  );
}

/** Console output of the last Playground run. Presentational only. */
export default function OutputPanel({ output, isExecuting, onClear }) {
  const [showTypeLabels, setShowTypeLabels] = useState(true);
  const errorCount = output.filter((e) => e.type === "error").length;

  return (
    <Card className="playground-output">
      <Card.Header
        icon={Terminal}
        title={
          <>
            Output{" "}
            {errorCount > 0 && (
              <Badge tone="danger">
                {errorCount} error{errorCount > 1 ? "s" : ""}
              </Badge>
            )}
          </>
        }
        subtitle="Console output and results"
        actions={
          <>
            <Checkbox
              checked={showTypeLabels}
              onChange={setShowTypeLabels}
              label="Show type labels"
            />
            {onClear && (
              <IconButton
                icon={Trash2}
                label="Clear output"
                onClick={onClear}
                disabled={output.length === 0}
              />
            )}
          </>
        }
      />
      <div className="console-output" aria-live="polite">
        {output.length === 0 && !isExecuting ? (
          <EmptyState
            icon={MessageSquare}
            title="No output yet"
            description={`Write code and click "Run" to see results`}
            className="console-empty"
          />
        ) : (
          <ol className="console-list">
            {output.map((entry, index) => (
              <OutputEntry
                key={index}
                type={entry.type}
                args={formatOutput(entry.args)}
                showTypeLabel={showTypeLabels}
              />
            ))}
            {isExecuting && (
              <li className="console-entry console-executing">
                {showTypeLabels && (
                  <span className="console-type">⏳ executing</span>
                )}
                <span className="console-data">Running code...</span>
              </li>
            )}
          </ol>
        )}
      </div>
    </Card>
  );
}
