import { Code2, Play, RotateCcw } from "lucide-react";
import { Button, Card } from "../ui/index.js";
import CodeEditor from "./CodeEditor.jsx";
import OutputPanel from "./OutputPanel.jsx";
import { usePlayground } from "../../hooks/playground/usePlayground.js";

/** Run window.salla.embedded.* snippets and inspect their console output. */
export default function PlaygroundTab({ embedded, logMessage, showToast }) {
  const {
    code,
    setCode,
    output,
    isExecuting,
    run,
    resetCode,
    clearOutput,
    isDefaultCode,
  } = usePlayground({ showToast });

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    }
  };

  return (
    <div className="playground-layout">
      <Card className="playground-editor">
        <Card.Header
          icon={Code2}
          title="Code Editor"
          subtitle="Write window.salla.embedded.* code · Ctrl/⌘ + Enter to run"
          actions={
            <>
              <Button
                size="small"
                variant="ghost"
                icon={RotateCcw}
                onClick={resetCode}
                disabled={isDefaultCode}
              >
                Reset
              </Button>
              <Button
                size="small"
                variant="primary"
                icon={Play}
                onClick={run}
                loading={isExecuting}
              >
                Run
              </Button>
            </>
          }
        />
        <div className="playground-editor-body" onKeyDown={handleKeyDown}>
          <CodeEditor value={code} onChange={setCode} height="600px" />
        </div>
      </Card>
      <OutputPanel
        output={output}
        isExecuting={isExecuting}
        onClear={clearOutput}
      />
    </div>
  );
}
