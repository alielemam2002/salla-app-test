import { useCallback, useEffect, useState } from "react";

const DEFAULT_MESSAGE = {
  event: "embedded::page.navigate",
  payload: { path: "/products" },
  timestamp: 1773234520517,
  source: "embedded-app",
};

const pretty = (value) => JSON.stringify(value, null, 2);

/**
 * Text state for the raw payload editor. Mirrors the last clicked event as a
 * BaseMessage and validates JSON before handing it to `onSend`.
 */
export function usePayloadEditor({ onSend, initialPayload, eventPayload }) {
  const [text, setText] = useState(
    () => initialPayload || pretty(DEFAULT_MESSAGE),
  );
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!eventPayload) return;
    const { eventName, payload } = eventPayload;
    setText(
      pretty({
        event: eventName,
        payload,
        timestamp: Date.now(),
        source: "embedded-app",
      }),
    );
    setError(null);
  }, [eventPayload]);

  const changeText = useCallback((value) => {
    setText(value);
    setError(null);
  }, []);

  const format = useCallback(() => {
    try {
      setText(pretty(JSON.parse(text)));
      setError(null);
    } catch (err) {
      setError("Invalid JSON: " + err.message);
    }
  }, [text]);

  const send = useCallback(() => {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      setError("Invalid JSON: " + err.message);
      return;
    }
    setError(null);
    onSend(parsed);
  }, [text, onSend]);

  return { text, setText: changeText, error, send, format };
}
