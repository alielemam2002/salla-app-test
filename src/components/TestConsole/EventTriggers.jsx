import { Zap } from "lucide-react";
import Card from "../ui/Card.jsx";
import EventSection from "./EventSection.jsx";
import { EVENT_TRIGGER_SECTIONS } from "./eventTriggerConfig.js";
import { useSdkEventDispatcher } from "../../hooks/testConsole/useSdkEventDispatcher.js";

/**
 * Event Triggers panel: renders the configured sections and wires each
 * button to the SDK through useSdkEventDispatcher.
 */
export default function EventTriggers({
  onEventClick,
  embedded,
  logMessage,
  showToast,
  bootstrap,
  onAddDynamicItem,
  onUpdateLatestDynamicItem,
  onRemoveLatestDynamicItem,
}) {
  const { trigger, fire } = useSdkEventDispatcher({
    embedded,
    bootstrap,
    logMessage,
    showToast,
    onEventClick,
    navSync: {
      addDynamicItem: onAddDynamicItem,
      updateLatestDynamicItem: onUpdateLatestDynamicItem,
      removeLatestDynamicItem: onRemoveLatestDynamicItem,
    },
  });

  const handlePress = (button) =>
    button.payload ? fire(button.event, button.payload) : trigger(button.event);

  return (
    <Card as="aside" className="console-triggers">
      <Card.Header
        icon={Zap}
        title="Event Triggers"
        subtitle="Send events to host (embedded::*)"
      />
      {EVENT_TRIGGER_SECTIONS.map((section) => (
        <EventSection
          key={section.id}
          title={section.title}
          icon={section.icon}
          buttons={section.buttons}
          onPress={handlePress}
        />
      ))}
    </Card>
  );
}
