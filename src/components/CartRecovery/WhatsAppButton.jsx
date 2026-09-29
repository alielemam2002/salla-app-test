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
      ? "Salla has no mobile number for this customer"
      : !number
        ? "The mobile number has no country code"
        : !cart?.checkout_url
          ? "Salla returned no checkout link for this cart"
          : null);

  if (reason) {
    return (
      <Button size={size} icon={MessageCircle} disabled title={reason}>
        WhatsApp
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
      aria-label={`Send WhatsApp to ${cart.customer?.name || "customer"}`}
    >
      <MessageCircle size={size === "small" ? 14 : 16} aria-hidden="true" />
      WhatsApp
    </a>
  );
}
