import { useCallback, useRef } from "react";
import { EmbeddedEvents } from "../../utils/eventDefinitions.js";
import { SDK_EVENT_HANDLERS } from "./sdkEventHandlers.js";

/**
 * Turns `embedded::*` event names into SDK calls for the Event Triggers panel.
 *
 * - `trigger(eventName)` uses the payload from eventDefinitions (and asks for
 *   confirmation when the event has a `warning`).
 * - `fire(eventName, payload)` sends an inline payload.
 * Both notify `onEventClick` so the payload editor mirrors the last event,
 * log the outgoing event, and report failures through `showToast`.
 */
export function useSdkEventDispatcher({
  embedded,
  bootstrap,
  logMessage,
  showToast,
  navSync,
  onEventClick,
}) {
  // Handlers read the latest context without re-creating callbacks.
  const ctxRef = useRef();
  ctxRef.current = { embedded, bootstrap, logMessage, showToast, navSync };

  const send = useCallback(async (eventName, payload) => {
    const ctx = ctxRef.current;
    ctx.logMessage("outgoing", { event: eventName, ...payload });

    const handler = SDK_EVENT_HANDLERS[eventName];
    if (!handler) {
      ctx.showToast("No Embedded SDK handler for event: " + eventName, "error");
      return;
    }

    try {
      await handler(payload, { ...ctx, eventName });
    } catch (error) {
      ctx.showToast("Failed to send SDK event: " + error.message, "error");
      ctx.logMessage(
        "outgoing",
        { event: eventName, ...payload },
        error.message,
      );
    }
  }, []);

  const fire = useCallback(
    (eventName, payload) => {
      onEventClick?.(eventName, payload);
      return send(eventName, payload);
    },
    [onEventClick, send],
  );

  const trigger = useCallback(
    async (eventName) => {
      const eventDef = EmbeddedEvents[eventName];
      if (!eventDef) {
        ctxRef.current.showToast("Unknown event: " + eventName, "error");
        return;
      }

      if (
        eventDef.warning &&
        !window.confirm(eventDef.warning + "\n\nContinue?")
      ) {
        return;
      }

      const payload = JSON.parse(JSON.stringify(eventDef.payload));
      if (eventName === "embedded::iframe.ready") {
        payload.height = document.body.scrollHeight || 600;
      }

      onEventClick?.(eventName, payload);
      await send(eventName, payload);
    },
    [onEventClick, send],
  );

  return { trigger, fire };
}
