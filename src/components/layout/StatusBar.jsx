import { Globe, MonitorSmartphone } from "lucide-react";
import { Badge } from "../ui/index.js";

function StatusItem({ icon: Icon, label, children }) {
  return (
    <div className="status-item">
      <Icon size={14} className="status-icon" aria-hidden="true" />
      <span className="status-label">{label}</span>
      {children}
    </div>
  );
}

export default function StatusBar({ isConnected, parentOrigin, iframeMode }) {
  return (
    <div className="status-bar" role="status" aria-live="polite">
      <Badge
        tone={isConnected ? "success" : "neutral"}
        dot
        className={isConnected ? "status-connected" : "status-disconnected"}
      >
        {isConnected ? "متصل بسلة" : "بانتظار لوحة سلة"}
      </Badge>
      <StatusItem icon={Globe} label="مصدر الصفحة">
        <code className="status-value">{parentOrigin || "—"}</code>
      </StatusItem>
      <StatusItem icon={MonitorSmartphone} label="الوضع">
        <code className="status-value">{iframeMode}</code>
      </StatusItem>
    </div>
  );
}
