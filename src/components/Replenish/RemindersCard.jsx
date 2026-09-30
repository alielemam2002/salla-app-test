import { BellRing, Send, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, IconButton } from "../ui/index.js";
import {
  STATUS_LABELS,
  dueLabel,
  formatDay,
} from "../../utils/replenish/replenishModel.js";
import { timeAgo } from "../../utils/cartRecovery/cartModel.js";

const STATUS_TONES = {
  scheduled: "info",
  sent: "success",
  failed: "danger",
  cancelled: "neutral",
  superseded: "neutral",
  skipped: "warning",
};

function ReminderRow({ reminder, onSendNow, onCancel, busy }) {
  const scheduled = reminder.status === "scheduled";
  const dueMs = Date.parse(reminder.dueAt);
  const name = reminder.customerName || "العميل";
  return (
    <tr>
      <td>
        <div className="cart-customer">
          <span className="cart-customer-name">{name}</span>
          <span className="cart-customer-phone" dir="ltr">
            {reminder.mobile}
          </span>
        </div>
      </td>
      <td>
        {reminder.productName || `منتج ${reminder.productId}`}
        {reminder.quantity > 1 && ` × ${reminder.quantity}`}
      </td>
      <td>
        {scheduled ? (
          <>
            {formatDay(dueMs)}{" "}
            <span className="form-hint">({dueLabel(dueMs)})</span>
          </>
        ) : reminder.sentAt ? (
          timeAgo(Date.parse(reminder.sentAt))
        ) : (
          "—"
        )}
      </td>
      <td>
        <Badge tone={STATUS_TONES[reminder.status] || "neutral"} dot>
          {STATUS_LABELS[reminder.status] || reminder.status}
        </Badge>
        {reminder.error && scheduled && (
          <p className="cart-row-error">{reminder.error}</p>
        )}
      </td>
      <td>
        {scheduled && (
          <div className="cart-actions">
            <Button
              size="small"
              variant="primary"
              icon={Send}
              loading={busy === reminder.id}
              disabled={Boolean(busy)}
              aria-label={`إرسال التذكير الآن إلى ${name}`}
              onClick={() => onSendNow(reminder)}
            >
              إرسال الآن
            </Button>
            <IconButton
              icon={X}
              size={14}
              label={`إلغاء تذكير ${name}`}
              onClick={() => onCancel(reminder)}
            />
          </div>
        )}
      </td>
    </tr>
  );
}

/** Scheduled reminders (soonest first), then what was sent or dropped. */
export default function RemindersCard({
  reminders,
  onSendNow,
  onCancel,
  busy,
}) {
  const scheduled = reminders.filter((r) => r.status === "scheduled").length;
  return (
    <Card>
      <Card.Header
        icon={BellRing}
        title={scheduled ? `التذكيرات (${scheduled} مجدول)` : "التذكيرات"}
        subtitle="تُجدول تلقائيًا عند وصول طلب فيه منتج له مدة استهلاك، وتُلغى إذا أُلغي الطلب أو اشترى العميل المنتج مرة أخرى."
      />
      <div className="replenish-body">
        {reminders.length ? (
          <div className="cart-table-wrap">
            <table className="cart-table">
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>المنتج</th>
                  <th>الموعد</th>
                  <th>الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reminders.map((reminder) => (
                  <ReminderRow
                    key={reminder.id}
                    reminder={reminder}
                    onSendNow={onSendNow}
                    onCancel={onCancel}
                    busy={busy}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={BellRing}
            title="لا توجد تذكيرات بعد"
            description="ستظهر هنا عند وصول طلب جديد لمنتج حددت مدة استهلاكه. يحتاج ذلك ربط طلبات سلة بالتطبيق (نفس ربط تبويب التنبيهات)."
          />
        )}
      </div>
    </Card>
  );
}
