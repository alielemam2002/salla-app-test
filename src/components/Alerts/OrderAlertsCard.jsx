import { Bell, CheckCheck, Copy, Trash2 } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Skeleton,
} from "../ui/index.js";
import { cx } from "../ui/cx.js";
import { stockLabel } from "../../utils/alerts/stockModel.js";
import { timeAgo } from "../../utils/cartRecovery/cartModel.js";

function SetupSteps({ webhookUrl, onCopy }) {
  return (
    <ol className="alerts-steps">
      <li>
        في بوابة الشركاء افتح: تطبيقاتي ← التطبيق ← Webhooks/Notifications، وضع
        هذا الرابط: <code dir="ltr">{webhookUrl}</code>{" "}
        <IconButton icon={Copy} label="نسخ الرابط" size={14} onClick={onCopy} />
      </li>
      <li>
        أضف الحدث <code dir="ltr">order.created</code> ثم احفظ.
      </li>
      <li>
        انسخ Webhook Secret من صفحة التطبيق، وأضفه في Vercel باسم{" "}
        <code dir="ltr">SALLA_WEBHOOK_SECRET</code> ثم أعد النشر.
      </li>
    </ol>
  );
}

function Setup({ setup, lastOrder, webhookUrl, onCopy }) {
  if (!setup.storage) {
    return (
      <Alert tone="warning" title="التنبيهات تحتاج إلى تخزين على الخادم">
        فعّل Upstash Redis في مشروع Vercel (نفس التخزين المستخدم لإعدادات
        واتساب).
      </Alert>
    );
  }
  if (!setup.webhookSecret) {
    return (
      <Alert tone="info" title="اربط الطلبات الجديدة بالتطبيق">
        <p>حتى يعرف التطبيق بكل طلب جديد فور حدوثه:</p>
        <SetupSteps webhookUrl={webhookUrl} onCopy={onCopy} />
      </Alert>
    );
  }
  if (!lastOrder) {
    return (
      <Alert tone="info" title="بانتظار أول طلب">
        <p>
          الربط جاهز على الخادم، لكن لم يصل أي طلب للتطبيق بعد. بعد أول طلب في
          متجرك ستظهر هنا حالة الربط.
        </p>
        <details>
          <summary>خطوات الربط</summary>
          <SetupSteps webhookUrl={webhookUrl} onCopy={onCopy} />
        </details>
      </Alert>
    );
  }
  return (
    <p className="form-hint">
      آخر طلب وصل للتطبيق {timeAgo(Date.parse(lastOrder.at))}.
    </p>
  );
}

function AlertItem({ alert }) {
  const ref = alert.orderRef || alert.orderId;
  return (
    <li className={cx("alerts-item", alert.unread && "is-unread")}>
      <Badge tone={alert.kind === "out" ? "danger" : "warning"} dot>
        {stockLabel(alert.kind, alert.quantity)}
      </Badge>
      <div className="alerts-item-text">
        <span className="alerts-item-title">
          {alert.productName || `منتج ${alert.productId}`}
          {alert.sku && (
            <span className="alerts-sku" dir="ltr">
              {alert.sku}
            </span>
          )}
        </span>
        <span className="alerts-item-meta">
          طلب <span dir="ltr">#{ref}</span>
          {alert.customer ? ` من ${alert.customer}` : ""} · الكمية المطلوبة{" "}
          {alert.ordered}
        </span>
      </div>
      <div className="alerts-item-side">
        {alert.unread && <Badge tone="info">جديد</Badge>}
        <span className="alerts-item-time">
          {timeAgo(Date.parse(alert.at))}
        </span>
      </div>
    </li>
  );
}

/**
 * Alerts written when a customer's order leaves a product at or under the
 * merchant's threshold (Salla's order.created webhook).
 */
export default function OrderAlertsCard({
  query,
  webhookUrl,
  onCopyUrl,
  onMarkRead,
  markingRead,
  onClear,
}) {
  const data = query.data;
  const unread = data?.unread || 0;
  const alerts = data?.alerts || [];

  let content;
  if (query.isPending) {
    content = <Skeleton height={48} />;
  } else if (query.isError) {
    content = (
      <Alert tone="error" title="تعذّر تحميل التنبيهات">
        {query.error.result?.error || "حاول مرة أخرى."}
      </Alert>
    );
  } else {
    content = (
      <>
        <Setup
          setup={data.setup}
          lastOrder={data.lastOrder}
          webhookUrl={webhookUrl}
          onCopy={onCopyUrl}
        />
        {alerts.length ? (
          <ul className="alerts-list">
            {alerts.map((alert) => (
              <AlertItem key={`${alert.id}-${alert.at}`} alert={alert} />
            ))}
          </ul>
        ) : (
          data.setup.storage && (
            <EmptyState
              icon={Bell}
              title="لا توجد تنبيهات"
              description="عندما يطلب عميل منتجًا وتصل كميته إلى الحد الذي اخترته أو تنفد، سيظهر التنبيه هنا."
            />
          )
        )}
      </>
    );
  }

  return (
    <Card className="alerts-card">
      <Card.Header
        icon={Bell}
        title={unread ? `تنبيهات الطلبات (${unread} جديد)` : "تنبيهات الطلبات"}
        subtitle="كل طلب يجعل كمية منتج عند الحد الذي اخترته أو أقل."
        actions={
          alerts.length > 0 && (
            <>
              {unread > 0 && (
                <Button
                  size="small"
                  variant="secondary"
                  icon={CheckCheck}
                  onClick={onMarkRead}
                  loading={markingRead}
                >
                  تحديد الكل كمقروء
                </Button>
              )}
              <IconButton
                icon={Trash2}
                label="مسح كل التنبيهات"
                size={14}
                onClick={onClear}
              />
            </>
          )
        }
      />
      <div className="alerts-body">{content}</div>
    </Card>
  );
}
