import { MessageCircle } from "lucide-react";
import { Button } from "../ui/index.js";
import {
  whatsappNumber,
  whatsappUrl,
} from "../../utils/cartRecovery/whatsappMessage.js";

/**
 * Opens WhatsApp (wa.me) with the customer's number and the filled-in
 * message. The merchant sends it from their own WhatsApp; the app only
 * records that WhatsApp was opened.
 */
export default function WhatsAppButton({
  cart,
  message,
  onOpened,
  size = "small",
  disabledReason,
}) {
  const number = whatsappNumber(cart?.customer?.mobile);
  const reason =
    disabledReason ||
    (!cart?.customer?.mobile
      ? "لا يوجد رقم جوال لهذا العميل في سلة"
      : !number
        ? "رقم الجوال بلا رمز الدولة"
        : !cart?.checkout_url
          ? "لم ترجع سلة رابط إكمال الطلب لهذه السلة"
          : null);

  if (reason) {
    return (
      <Button size={size} icon={MessageCircle} disabled title={reason}>
        واتساب
      </Button>
    );
  }

  return (
    <a
      className={`btn btn-success${size === "small" ? " btn-small" : ""}`}
      href={whatsappUrl(number, message)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onOpened?.(cart.id)}
      aria-label={`مراسلة ${cart.customer?.name || "العميل"} عبر واتساب`}
    >
      <MessageCircle size={size === "small" ? 14 : 16} aria-hidden="true" />
      واتساب
    </a>
  );
}
