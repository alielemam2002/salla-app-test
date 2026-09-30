import { Copy, ExternalLink, ShoppingCart } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  KeyValueList,
  Modal,
  Skeleton,
} from "../ui/index.js";
import { useAbandonedCart } from "../../hooks/cartRecovery/useCartRecovery.js";
import {
  describeCartsError,
  formatMoney,
  money,
} from "../../utils/cartRecovery/cartModel.js";
import WhatsAppButton from "./WhatsAppButton.jsx";
import ApiSendButton from "./ApiSendButton.jsx";

/**
 * Full cart from GET /carts/abandoned/{id}: customer, items (names looked
 * up from products), totals, Salla's status and the recovery actions.
 * Missing customer data is shown as missing, never guessed.
 */
export default function CartDetailsModal({
  cartId,
  getToken,
  messageFor,
  onClose,
  onCopyLink,
  onContacted,
  api,
}) {
  const query = useAbandonedCart(getToken, cartId);
  const cart = query.data?.cart;
  const products = query.data?.products || {};
  const purchased = cart?.status === "purchased";
  const currency = money(cart?.total).currency;

  let body;
  if (query.isPending) {
    body = (
      <div className="cart-details" aria-busy="true">
        {[60, 45, 80, 70, 90].map((w) => (
          <Skeleton key={w} width={`${w}%`} height={16} />
        ))}
      </div>
    );
  } else if (query.isError) {
    body = (
      <Alert tone="error" title="تعذّر تحميل هذه السلة">
        {describeCartsError(query.error.result)}
      </Alert>
    );
  } else {
    const missing = <span className="cart-missing">غير متوفر من سلة</span>;
    body = (
      <div className="cart-details">
        {purchased && (
          <Alert tone="success" title="تم شراء هذه السلة">
            أكمل العميل الطلب، لذا لا حاجة لإرسال تذكير.
          </Alert>
        )}

        <KeyValueList
          items={[
            {
              label: "العميل",
              value: cart.customer?.name || missing,
              mono: false,
            },
            {
              label: "البريد الإلكتروني",
              value: cart.customer?.email ? (
                <span dir="ltr">{cart.customer.email}</span>
              ) : (
                missing
              ),
            },
            {
              label: "الجوال",
              value: cart.customer?.mobile ? (
                <span dir="ltr">{cart.customer.mobile}</span>
              ) : (
                missing
              ),
            },
            {
              label: "الحالة",
              mono: false,
              value: (
                <Badge tone={purchased ? "success" : "warning"} dot>
                  {purchased ? "تم الشراء" : "نشطة"}
                </Badge>
              ),
            },
            ...(cart.coupon?.code
              ? [{ label: "الكوبون على السلة", value: cart.coupon.code }]
              : []),
          ]}
        />

        <table className="cart-items">
          <thead>
            <tr>
              <th scope="col">المنتج</th>
              <th scope="col">الكمية</th>
              <th scope="col">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {(cart.items || []).map((item) => {
              const product = products[String(item.product_id)];
              const line = item.amounts?.total;
              return (
                <tr key={item.id}>
                  <td>
                    {product?.name || `منتج رقم ${item.product_id}`}
                    {item.notes && (
                      <span className="cart-item-notes">{item.notes}</span>
                    )}
                  </td>
                  <td className="cart-num">×{item.quantity}</td>
                  <td className="cart-num">
                    {line ? formatMoney(money(line, currency)) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {cart.total_discount && money(cart.total_discount).amount > 0 && (
              <tr>
                <th scope="row" colSpan={2}>
                  الخصم
                </th>
                <td className="cart-num">
                  −{formatMoney(money(cart.total_discount, currency))}
                </td>
              </tr>
            )}
            <tr>
              <th scope="row" colSpan={2}>
                الإجمالي
              </th>
              <td className="cart-num">
                <strong>{formatMoney(money(cart.total))}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      icon={ShoppingCart}
      title={`سلة رقم ${cartId}`}
      subtitle="سلة متروكة"
      size="lg"
      footer={
        cart && (
          <>
            <Button
              size="small"
              icon={Copy}
              onClick={() => onCopyLink(cart)}
              disabled={!cart.checkout_url}
            >
              نسخ رابط الاسترجاع
            </Button>
            {cart.checkout_url && (
              <a
                className="btn btn-small btn-secondary"
                href={cart.checkout_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={14} aria-hidden="true" /> فتح صفحة الدفع
              </a>
            )}
            {api && (
              <ApiSendButton
                cart={cart}
                sender={api.sender}
                apiSends={api.sends}
                couponCode={api.couponCode}
                mode={api.mode}
                text={api.mode === "text" ? messageFor(cart) : ""}
                onResult={api.onResult}
                onConfirmResend={api.onConfirmResend}
                disabledReason={purchased ? "أكمل العميل الطلب بالفعل" : null}
              />
            )}
            <WhatsAppButton
              cart={cart}
              message={messageFor(cart)}
              onOpened={onContacted}
              disabledReason={purchased ? "أكمل العميل الطلب بالفعل" : null}
            />
          </>
        )
      }
    >
      {body}
    </Modal>
  );
}
