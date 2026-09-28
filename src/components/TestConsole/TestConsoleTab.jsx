import { useToast } from "../../contexts/ToastContext.jsx";
import { useTestConsole } from "../../hooks/testConsole/useTestConsole.js";
import EventTriggers from "./EventTriggers.jsx";
import MessageLog from "./MessageLog.jsx";
import DataDisplay from "./DataDisplay.jsx";
import PayloadEditor from "./PayloadEditor.jsx";

/**
 * Test Console tab: SDK event triggers on one side, the live message log,
 * context data and raw payload editor on the other.
 *
 * @param {object} props.embedded      SDK instance
 * @param {function} props.bootstrap   init → getToken → verify → ready
 * @param {object} props.layout        LayoutInfo from init()
 * @param {string} props.token         session token from the URL
 * @param {object} props.verifiedData  backend verification payload
 * @param {string} props.verifyStatus  raw status ("verified" | "failed" | "verifying" | …)
 * @param {object} props.messageLog    return value of useMessageLog()
 * @param {object} props.navSync       { addDynamicItem, updateLatestDynamicItem, removeLatestDynamicItem }
 */
export default function TestConsoleTab({
  embedded,
  bootstrap,
  layout,
  token,
  verifiedData,
  verifyStatus,
  messageLog,
  navSync,
}) {
  const { showToast } = useToast();
  const { eventPayload, handleEventClick, handleSendCustom, handleCopyLog } =
    useTestConsole({
      logMessage: messageLog.logMessage,
      copyLog: messageLog.copyLog,
      showToast,
    });

  return (
    <div className="console-layout">
      <EventTriggers
        embedded={embedded}
        logMessage={messageLog.logMessage}
        showToast={showToast}
        bootstrap={bootstrap}
        onEventClick={handleEventClick}
        onAddDynamicItem={navSync?.addDynamicItem}
        onUpdateLatestDynamicItem={navSync?.updateLatestDynamicItem}
        onRemoveLatestDynamicItem={navSync?.removeLatestDynamicItem}
      />
      <div className="console-main">
        <MessageLog
          messageLog={messageLog.messageLog}
          filterUnknown={messageLog.filterUnknown}
          onFilterChange={messageLog.setFilterUnknown}
          onClear={messageLog.clearLog}
          onCopy={handleCopyLog}
        />
        <div className="console-data-row">
          <DataDisplay
            layoutData={layout}
            token={token}
            verifiedData={verifiedData}
            verifyStatus={verifyStatus}
          />
        </div>
        <PayloadEditor onSend={handleSendCustom} eventPayload={eventPayload} />
      </div>
    </div>
  );
}
