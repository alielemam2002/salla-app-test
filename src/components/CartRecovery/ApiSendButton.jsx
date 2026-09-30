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
      ? "لا يوجد رقم جوال دولي لهذا العميل"
      : recentlySent(apiSends, cart.id)
        ? "تم الإرسال خلال آخر 24 ساعة"
        : null);
  const busy = sender.sending.has(cart.id);

  return (
    <Button
      size="small"
      variant="primary"
      icon={Send}
      disabled={Boolean(reason) || Boolean(sender.batch?.running)}
      title={reason || "إرسال قالب واتساب من التطبيق"}
      loading={busy}
      aria-label={`إرسال عبر واتساب إلى ${cart.customer?.name || "العميل"}`}
      onClick={async () => {
        const result = await sender.send(cart.id, couponCode);
        onResult?.(cart, result);
      }}
    >
      إرسال
    </Button>
  );
}
