import { Send } from "lucide-react";
import { Button } from "../ui/index.js";
import { whatsappNumber } from "../../utils/cartRecovery/whatsappMessage.js";
import { recentlySent } from "../../utils/cartRecovery/recoveryStorage.js";

/**
 * Send the approved WhatsApp template (or the text message) for this cart
 * through the Cloud API (the server reads the cart from Salla and calls
 * Meta). If the cart already got a message in the last 24 hours, it asks
 * first through `onConfirmResend(cart, sentAt, send)` instead of sending.
 */
export default function ApiSendButton({
  cart,
  sender,
  apiSends,
  couponCode,
  mode = "template",
  text = "",
  onResult,
  onConfirmResend,
  disabledReason,
}) {
  const reason =
    disabledReason ||
    (!whatsappNumber(cart?.customer?.mobile)
      ? "لا يوجد رقم جوال دولي لهذا العميل"
      : null);
  const recent = recentlySent(apiSends, cart.id);
  const busy = sender.sending.has(cart.id);

  const send = async () => {
    const result = await sender.send(
      cart.id,
      couponCode,
      mode === "text" ? { mode, text } : undefined,
    );
    onResult?.(cart, result);
  };

  return (
    <Button
      size="small"
      variant="primary"
      icon={Send}
      disabled={Boolean(reason) || Boolean(sender.batch?.running)}
      title={
        reason ||
        (recent
          ? "أُرسلت لهذا العميل رسالة خلال آخر 24 ساعة؛ سيُطلب منك التأكيد"
          : "إرسال رسالة واتساب من التطبيق")
      }
      loading={busy}
      aria-label={`إرسال عبر واتساب إلى ${cart.customer?.name || "العميل"}`}
      onClick={() => {
        if (recent && onConfirmResend) {
          onConfirmResend(cart, apiSends[cart.id]?.at, send);
          return;
        }
        send();
      }}
    >
      إرسال
    </Button>
  );
}
