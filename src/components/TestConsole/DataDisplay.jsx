import { Check, Copy, KeyRound, LayoutTemplate } from "lucide-react";
import { Badge, Card, IconButton, KeyValueList } from "../ui/index.js";
import { useClipboard } from "../../hooks/ui/useClipboard.js";
import {
  describeVerifyStatus,
  maskToken,
} from "../../utils/testConsoleFormat.js";

/**
 * Layout context and token verification details.
 * `verifyStatus` is the raw bootstrap status ("verified" | "failed" | "verifying" | …).
 */
export default function DataDisplay({
  layoutData,
  token,
  verifiedData,
  verifyStatus,
}) {
  const { copied, copy } = useClipboard();
  const status = describeVerifyStatus(verifyStatus);

  const layoutItems = [
    { label: "Theme", value: layoutData?.theme },
    {
      label: "Width",
      value: layoutData?.width ? `${layoutData.width}px` : null,
    },
    { label: "Locale", value: layoutData?.locale },
    { label: "Direction", value: layoutData?.dir },
    { label: "Currency", value: layoutData?.currency },
  ];

  const verifyItems = [
    {
      label: "Verify Status",
      mono: false,
      value: (
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      ),
    },
    { label: "Store ID", value: verifiedData?.store_id },
    { label: "User ID", value: verifiedData?.user_id },
    { label: "Owner ID", value: verifiedData?.owner_id },
    { label: "Expiry", value: verifiedData?.exp },
  ];

  return (
    <>
      <Card className="console-data">
        <Card.Header
          icon={LayoutTemplate}
          title="Layout Data"
          subtitle="From embedded::context.provide"
        />
        <Card.Body>
          <KeyValueList items={layoutItems} className="console-kv-grid" />
        </Card.Body>
      </Card>

      <Card className="console-data">
        <Card.Header
          icon={KeyRound}
          title="Token Verification"
          subtitle="From URL param & API response"
        />
        <Card.Body>
          <div className="console-token">
            <span className="data-label">Token</span>
            <div className="console-token-row">
              <code className="data-value console-token-value">
                {token ? maskToken(token) : "—"}
              </code>
              {token && (
                <IconButton
                  icon={copied ? Check : Copy}
                  label={copied ? "Token copied" : "Copy token"}
                  tone="primary"
                  onClick={() => copy(token)}
                />
              )}
            </div>
          </div>
          <KeyValueList items={verifyItems} className="console-kv-grid" />
        </Card.Body>
      </Card>
    </>
  );
}
