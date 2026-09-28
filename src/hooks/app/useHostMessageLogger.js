import { useEffect } from "react";

/**
 * Test-console tooling: log every incoming `embedded::*` postMessage and
 * remember the host origin from the first cross-origin message.
 * Real embedded apps should not include this.
 */
export function useHostMessageLogger({ logMessage, setParentOrigin }) {
  useEffect(() => {
    const handleIncomingMessage = (event) => {
      if (!event.data?.event?.startsWith?.("embedded::")) return;

      logMessage("incoming", event.data, null, event.origin);

      if (event.origin && event.origin !== window.location.origin) {
        setParentOrigin(event.origin);
      }
    };

    window.addEventListener("message", handleIncomingMessage);
    return () => window.removeEventListener("message", handleIncomingMessage);
  }, [logMessage, setParentOrigin]);
}
