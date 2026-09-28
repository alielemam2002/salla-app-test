import { useCallback, useState } from "react";

/**
 * Test Console tooling state: the payload mirrored into the editor, sending
 * raw payloads to the parent window, and copying the message log.
 *
 * Raw postMessage is for debugging the bridge only; real apps must call SDK
 * methods instead.
 */
export function useTestConsole({ logMessage, copyLog, showToast }) {
  const [eventPayload, setEventPayload] = useState(null);

  const handleEventClick = useCallback((eventName, payload) => {
    setEventPayload({ eventName, payload });
  }, []);

  const handleSendCustom = useCallback(
    (payload) => {
      const target = window.parent !== window ? window.parent : window.opener;

      if (!target || target === window) {
        showToast(
          "No parent window detected. Open this page in an iframe.",
          "error",
        );
        logMessage("outgoing", payload, "No parent window");
        return;
      }

      try {
        target.postMessage(payload, "*");
        logMessage("outgoing", payload);
      } catch (error) {
        showToast("Failed to send message: " + error.message, "error");
        logMessage("outgoing", payload, error.message);
      }
    },
    [showToast, logMessage],
  );

  const handleCopyLog = useCallback(async () => {
    const success = await copyLog();
    showToast(
      success ? "Log copied to clipboard" : "Failed to copy log",
      success ? "success" : "error",
    );
    return success;
  }, [copyLog, showToast]);

  return { eventPayload, handleEventClick, handleSendCustom, handleCopyLog };
}
