import Editor from "@monaco-editor/react";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { loadSdkTypes } from "../../hooks/playground/loadSdkTypes.js";
import Spinner from "../ui/Spinner.jsx";

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 14,
  wordWrap: "on",
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  padding: { top: 12 },
};

/** Monaco editor themed to the app, with Embedded SDK typings loaded. */
export default function CodeEditor({ value, onChange, height = "400px" }) {
  const { isDarkMode } = useTheme();

  return (
    <Editor
      height={height}
      language="typescript"
      theme={isDarkMode ? "vs-dark" : "vs-light"}
      value={value}
      onChange={onChange}
      onMount={loadSdkTypes}
      loading={<Spinner label="Loading editor…" />}
      options={EDITOR_OPTIONS}
    />
  );
}
