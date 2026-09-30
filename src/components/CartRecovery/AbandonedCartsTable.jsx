import { memo } from "react";
import { Copy, Eye, EyeOff, Undo2 } from "lucide-react";
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
  selection,
  isHidden,
  onHide,
  onUnhide,
}) {
  const apiSent = api?.sends[cart.id];
  const blocked = selection?.reasonFor(cart);
  const apiError = api?.sender.errors[cart.id];
  const eligible = isEligible(cart, abandonedAfter);
  const items = itemCount(cart);
  return (
    <tr className={isHidden ? "cart-row--hidden" : undefined}>
      {selection && (
        <td className="cart-select">
          <input
            type="checkbox"
            checked={selection.isSelected(cart.id)}
            disabled={Boolean(blocked) || selection.locked}
            onChange={() => selection.toggle(cart.id)}
            aria-label={`تحديد سلة ${cart.customer?.name || "زائر"}`}
            title={blocked || undefined}
          />
        </td>
      )}
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
          {isHidden && <Badge tone="neutral">مخفية</Badge>}
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
              onConfirmResend={api.onConfirmResend}
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
          {onHide &&
            (isHidden ? (
              <IconButton
                icon={Undo2}
                label={`إظهار سلة ${cart.customer?.name || "زائر"} في القائمة`}
                size={14}
                onClick={() => onUnhide(cart.id)}
              />
            ) : (
              <IconButton
                icon={EyeOff}
                label={`إخفاء سلة ${cart.customer?.name || "زائر"} من القائمة`}
                size={14}
                onClick={() => onHide(cart.id)}
              />
            ))}
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
 * Abandoned carts with the WhatsApp / details / copy-link / hide actions.
 * `api` (only when the WhatsApp Cloud API is configured) adds the "Send"
 * button. `selection` adds a checkbox column for "send to selected":
 * { isSelected, toggle, reasonFor(cart) → why it can't be picked, allSelected,
 * toggleAll, locked }. `hidden` marks carts hidden in this browser.
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
  selection,
  hidden = {},
  onHide,
  onUnhide,
}) {
  const now = Date.now();
  return (
    <div className="cart-table-wrap">
      <table className="cart-table">
        <thead>
          <tr>
            {selection && (
              <th scope="col" className="cart-select">
                <input
                  type="checkbox"
                  checked={selection.allSelected}
                  disabled={selection.locked}
                  onChange={selection.toggleAll}
                  aria-label="تحديد كل السلات المعروضة التي يمكن مراسلتها"
                />
              </th>
            )}
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
              selection={selection}
              isHidden={Boolean(hidden[cart.id])}
              onHide={onHide}
              onUnhide={onUnhide}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
