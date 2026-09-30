import { memo } from "react";
import { Copy, Eye } from "lucide-react";
import { Badge, Button, IconButton } from "../ui/index.js";
import {
  formatMoney,
  isEligible,
  itemCount,
  money,
  sallaDateMs,
  timeAgo,
} from "../../utils/cartRecovery/cartModel.js";
import WhatsAppButton from "./WhatsAppButton.jsx";
import ApiSendButton from "./ApiSendButton.jsx";

const CartRow = memo(function CartRow({
  cart,
  abandonedAfter,
  contactedAt,
  message,
  now,
  onView,
  onCopyLink,
  onContacted,
  api,
}) {
  const apiSent = api?.sends[cart.id];
  const apiError = api?.sender.errors[cart.id];
  const eligible = isEligible(cart, abandonedAfter);
  const items = itemCount(cart);
  return (
    <tr>
      <td>
        <div className="cart-customer">
          <span className="cart-customer-name">
            {cart.customer?.name || "زائر"}
          </span>
          {cart.customer?.mobile && (
            <span className="cart-customer-phone" dir="ltr">
              {cart.customer.mobile}
            </span>
          )}
        </div>
      </td>
      <td className="cart-num">{formatMoney(money(cart.total))}</td>
      <td className="cart-num">
        {items} {items === 1 ? "منتج" : "منتجات"}
      </td>
      <td>{timeAgo(sallaDateMs(cart.created_at), now)}</td>
      <td>{timeAgo(sallaDateMs(cart.updated_at), now)}</td>
      <td>
        <div className="cart-status">
          <Badge tone={eligible ? "warning" : "neutral"} dot>
            {eligible ? "متروكة" : "حديثة"}
          </Badge>
          {contactedAt && (
            <Badge
              tone="success"
              title={new Date(contactedAt).toLocaleString()}
            >
              واتساب {timeAgo(Date.parse(contactedAt), now)}
            </Badge>
          )}
          {apiSent && (
            <Badge
              tone="info"
              title={`قبلتها Meta · رقم الرسالة ${apiSent.messageId || "—"}`}
            >
              أُرسلت من التطبيق {timeAgo(Date.parse(apiSent.at), now)}
            </Badge>
          )}
        </div>
      </td>
      <td>
        <div className="cart-actions">
          {api && (
            <ApiSendButton
              cart={cart}
              sender={api.sender}
              apiSends={api.sends}
              couponCode={api.couponCode}
              mode={api.mode}
              text={api.mode === "text" ? message : ""}
              onResult={api.onResult}
            />
          )}
          <WhatsAppButton
            cart={cart}
            message={message}
            onOpened={onContacted}
          />
          <Button
            size="small"
            variant="secondary"
            icon={Eye}
            onClick={() => onView(cart)}
            aria-label={`عرض سلة ${cart.customer?.name || "زائر"}`}
          >
            التفاصيل
          </Button>
          <IconButton
            icon={Copy}
            label="نسخ الرابط"
            size={14}
            onClick={() => onCopyLink(cart)}
            disabled={!cart.checkout_url}
          />
        </div>
        {apiError && (
          <p className="cart-row-error" role="alert">
            {apiError.error}
          </p>
        )}
      </td>
    </tr>
  );
});

/**
 * Abandoned carts with the WhatsApp / details / copy-link actions.
 * `api` (only when the WhatsApp Cloud API is configured) adds the "Send"
 * button: { sender, sends, couponCode, onResult }.
 */
export default function AbandonedCartsTable({
  carts,
  abandonedAfter,
  contacts,
  messageFor,
  onView,
  onCopyLink,
  onContacted,
  api,
}) {
  const now = Date.now();
  return (
    <div className="cart-table-wrap">
      <table className="cart-table">
        <thead>
          <tr>
            <th scope="col">العميل</th>
            <th scope="col">قيمة السلة</th>
            <th scope="col">منتجات</th>
            <th scope="col">تاريخ الإنشاء</th>
            <th scope="col">آخر نشاط</th>
            <th scope="col">الحالة</th>
            <th scope="col">استرجاع السلة</th>
          </tr>
        </thead>
        <tbody>
          {carts.map((cart) => (
            <CartRow
              key={cart.id}
              cart={cart}
              abandonedAfter={abandonedAfter}
              contactedAt={contacts[cart.id]}
              message={messageFor(cart)}
              now={now}
              onView={onView}
              onCopyLink={onCopyLink}
              onContacted={onContacted}
              api={api}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
