import { useCallback, useState } from "react";
import { useCodeExecution } from "../useCodeExecution.js";
import { DEFAULT_CODE } from "./defaultCode.js";

/** Editor text + run/reset/clear actions for the Playground tab. */
export function usePlayground({ showToast }) {
  const [code, setCode] = useState(DEFAULT_CODE);
  const { output, isExecuting, executeCode, clearOutput } = useCodeExecution();

  const run = useCallback(() => {
    if (!code.trim()) {
      showToast("Please enter some code", "warning");
      return;
    }
    executeCode(code);
  }, [code, executeCode, showToast]);

  const resetCode = useCallback(() => setCode(DEFAULT_CODE), []);

  return {
    code,
    setCode,
    output,
    isExecuting,
    run,
    resetCode,
    clearOutput,
    isDefaultCode: code === DEFAULT_CODE,
  };
}
