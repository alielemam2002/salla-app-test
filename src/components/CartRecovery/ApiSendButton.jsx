import { Send } from "lucide-react";
import { Button } from "../ui/index.js";
import { whatsappNumber } from "../../utils/cartRecovery/whatsappMessage.js";
import { recentlySent } from "../../utils/cartRecovery/recoveryStorage.js";

/**
 * Send the approved WhatsApp template for this cart through the Cloud API
 * (the server reads the cart from Salla and calls Meta).
 */
export default function ApiSendButton({
  cart,
  sender,
  apiSends,
  couponCode,
  onResult,
  disabledReason,
}) {
  const reason =
    disabledReason ||
    (!whatsappNumber(cart?.customer?.mobile)
      ? "No international mobile number for this customer"
      : recentlySent(apiSends, cart.id)
        ? "Already sent in the last 24 hours"
        : null);
  const busy = sender.sending.has(cart.id);

  return (
    <Button
      size="small"
      variant="primary"
      icon={Send}
      disabled={Boolean(reason) || Boolean(sender.batch?.running)}
      title={reason || "Send the WhatsApp template through the Cloud API"}
      loading={busy}
      aria-label={`Send via API to ${cart.customer?.name || "customer"}`}
      onClick={async () => {
        const result = await sender.send(cart.id, couponCode);
        onResult?.(cart, result);
      }}
    >
      Send
    </Button>
  );
}
