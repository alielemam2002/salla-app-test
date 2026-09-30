import { useState, useMemo } from "react";
import {
  Users,
  ShoppingBag,
  Clock,
  AlertCircle,
  ExternalLink,
  MessageCircle,
  Edit3,
  Search,
  CheckCircle2,
  Calendar,
  Send,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  Badge,
  Button,
  EmptyState,
  TextInput,
  Select,
} from "../ui/index.js";
import {
  formatDay,
  renderReplenishMessage,
  replenishWhatsappUrl,
  DAY_MS,
} from "../../utils/replenish/replenishModel.js";
import { timeAgo } from "../../utils/cartRecovery/cartModel.js";

/**
 * Customer Orders & Sales Insights for Replenishment:
 * Shows the merchant a clear overview of who bought which products,
 * their consumption cycles, estimated depletion date, and allows
 * sending a tailored replenishment reminder to any customer via WhatsApp.
 */
export default function CustomerOrdersCard({
  reminders = [],
  cycles = {},
  onOpenMessage,
  onNewManualReminder,
  customMessageTemplate,
  couponCode = "",
}) {
  const [keyword, setKeyword] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // 'all' | 'due_soon' | 'scheduled' | 'sent'

  // Enrich reminders with cycle information and consumption calculations
  const enrichedOrders = useMemo(() => {
    const now = Date.now();

    return reminders.map((r) => {
      const cycleDays = r.cycleDays || cycles[r.productId]?.days || 30;
      const quantity = r.quantity || 1;
      const totalCycleDays = cycleDays * quantity;
      const orderedMs = r.orderedAt ? Date.parse(r.orderedAt) : now;
      const depletionMs = orderedMs + totalCycleDays * DAY_MS;
      const dueMs = r.dueAt ? Date.parse(r.dueAt) : depletionMs - 5 * DAY_MS;

      const daysLeftUntilDepletion = Math.ceil((depletionMs - now) / DAY_MS);
      const daysLeftUntilDue = Math.ceil((dueMs - now) / DAY_MS);

      // Determine urgency
      const isDueSoon = r.status === "scheduled" && daysLeftUntilDue <= 3;
      const isDepleted = daysLeftUntilDepletion <= 0;

      const waUrl = replenishWhatsappUrl(
        r.mobile,
        renderReplenishMessage(customMessageTemplate, r, { couponCode }),
      );

      return {
        ...r,
        cycleDays,
        totalCycleDays,
        depletionMs,
        dueMs,
        daysLeftUntilDepletion,
        daysLeftUntilDue,
        isDueSoon,
        isDepleted,
        waUrl,
      };
    });
  }, [reminders, cycles, customMessageTemplate, couponCode]);

  // Filter and search
  const filteredOrders = useMemo(() => {
    return enrichedOrders.filter((order) => {
      const q = keyword.trim().toLowerCase();
      if (q) {
        const matchesName = (order.customerName || "")
          .toLowerCase()
          .includes(q);
        const matchesPhone = (order.mobile || "").includes(q);
        const matchesProduct = (order.productName || "")
          .toLowerCase()
          .includes(q);
        const matchesOrder = String(order.orderId || "").includes(q);
        if (!matchesName && !matchesPhone && !matchesProduct && !matchesOrder) {
          return false;
        }
      }

      if (filterStatus === "due_soon") {
        return order.isDueSoon || order.isDepleted;
      }
      if (filterStatus === "scheduled") {
        return order.status === "scheduled";
      }
      if (filterStatus === "sent") {
        return order.status === "sent";
      }
      return true;
    });
  }, [enrichedOrders, keyword, filterStatus]);

  // High-level summary metrics
  const stats = useMemo(() => {
    const totalCustomers = new Set(
      reminders.map((r) => r.mobile || r.customerName),
    ).size;
    const dueSoonCount = enrichedOrders.filter(
      (o) => o.isDueSoon || o.isDepleted,
    ).length;
    const sentCount = reminders.filter((r) => r.status === "sent").length;
    return {
      totalCustomers,
      dueSoonCount,
      sentCount,
      totalOrders: reminders.length,
    };
  }, [reminders, enrichedOrders]);

  return (
    <Card>
      <Card.Header
        icon={Users}
        title="مبيعات وطلبات العملاء (سجل إعادة الشراء)"
        subtitle="تعرف على مشتريات عملائك وتاريخ نفاد منتجاتهم، للتذكير في الوقت المناسب."
        actions={
          <Button
            size="small"
            variant="secondary"
            icon={Plus}
            onClick={onNewManualReminder}
            title="إرسال تذكير مخصص لعميل محدد"
          >
            تذكير عميل محدد
          </Button>
        }
      />

      <div className="replenish-body">
        {/* Quick Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              background: "var(--bg-secondary)",
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}
            >
              العملاء في السجل
            </div>
            <div
              style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "2px" }}
            >
              {stats.totalCustomers}
            </div>
          </div>

          <div
            style={{
              background:
                stats.dueSoonCount > 0
                  ? "rgba(239, 68, 68, 0.08)"
                  : "var(--bg-secondary)",
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              border:
                stats.dueSoonCount > 0
                  ? "1px solid rgba(239, 68, 68, 0.25)"
                  : "1px solid var(--border-color)",
            }}
          >
            <div
              style={{
                fontSize: "0.76rem",
                color:
                  stats.dueSoonCount > 0
                    ? "var(--color-danger, #ef4444)"
                    : "var(--text-secondary)",
              }}
            >
              أوشك على النفاد (حان وقت التذكير)
            </div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                marginTop: "2px",
                color:
                  stats.dueSoonCount > 0
                    ? "var(--color-danger, #ef4444)"
                    : "inherit",
              }}
            >
              {stats.dueSoonCount}
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-secondary)",
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}
            >
              تذكيرات تم إرسالها
            </div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                marginTop: "2px",
                color: "var(--color-success, #22c55e)",
              }}
            >
              {stats.sentCount}
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: "12px",
          }}
        >
          <div style={{ flex: 1, minWidth: "220px" }}>
            <TextInput
              type="search"
              placeholder="ابحث باسم العميل، الجوال، أو المنتج..."
              prefix={<Search size={14} aria-hidden="true" />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <div style={{ width: "170px" }}>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              options={[
                { value: "all", label: "جميع الطلبات" },
                { value: "due_soon", label: "أوشك على النفاد 🔔" },
                { value: "scheduled", label: "مجدول فقط" },
                { value: "sent", label: "تم الإرسال" },
              ]}
            />
          </div>
        </div>

        {/* Orders Table */}
        {filteredOrders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={
              reminders.length === 0
                ? "لا توجد طلبات مسجلة بعد"
                : "لا توجد نتائج مطابقة"
            }
            description={
              reminders.length === 0
                ? "عند وصول طلبات جديدة في متجرك لمنتجات محدد لها مدة استهلاك، ستظهر تفاصيل العميل والطلب هنا تلقائيًا مع موعد التذكير."
                : "جرّب تغيير كلمة البحث أو الفلتر."
            }
          />
        ) : (
          <div className="cart-table-wrap">
            <table className="cart-table">
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>الطلب والمنتج</th>
                  <th>مدة الاستهلاك والنفاد</th>
                  <th>حالة التذكير</th>
                  <th>إجراء مباشر</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const name = order.customerName || "عميل المتجر";
                  return (
                    <tr key={order.id}>
                      {/* Customer */}
                      <td>
                        <div className="cart-customer">
                          <span
                            className="cart-customer-name"
                            style={{ fontWeight: 600 }}
                          >
                            {name}
                          </span>
                          <span className="cart-customer-phone" dir="ltr">
                            {order.mobile}
                          </span>
                        </div>
                      </td>

                      {/* Order & Product */}
                      <td>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>
                            {order.productName || `منتج ${order.productId}`}
                            {order.quantity > 1 && ` × ${order.quantity}`}
                          </span>
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              alignItems: "center",
                              fontSize: "0.78rem",
                            }}
                          >
                            {order.orderId && order.orderId !== "manual" && (
                              <span className="form-hint">
                                طلب #{order.orderRef || order.orderId}
                              </span>
                            )}
                            {order.productUrl && (
                              <a
                                href={order.productUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="form-hint"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "2px",
                                  color: "var(--color-primary)",
                                }}
                              >
                                <span>رابط المنتج</span>
                                <ExternalLink size={10} aria-hidden="true" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Cycle & Depletion */}
                      <td>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                            fontSize: "0.85rem",
                          }}
                        >
                          <span>
                            تكفي <strong>{order.totalCycleDays} يومًا</strong>
                            {order.quantity > 1 && (
                              <span className="form-hint">
                                {" "}
                                ({order.cycleDays} يوم/قطعة)
                              </span>
                            )}
                          </span>
                          <span className="form-hint">
                            ينفد: {formatDay(order.depletionMs)}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        {order.status === "sent" ? (
                          <Badge tone="success" dot>
                            تم التذكير{" "}
                            {order.sentAt
                              ? timeAgo(Date.parse(order.sentAt))
                              : ""}
                          </Badge>
                        ) : order.isDepleted ? (
                          <Badge tone="danger" dot>
                            نفد المنتج عند العميل
                          </Badge>
                        ) : order.isDueSoon ? (
                          <Badge tone="warning" dot>
                            أوشك على النفاد (باقي {order.daysLeftUntilDepletion}{" "}
                            يوم)
                          </Badge>
                        ) : (
                          <Badge tone="info" dot>
                            متبقي {order.daysLeftUntilDepletion} يومًا
                          </Badge>
                        )}
                      </td>

                      {/* Direct Actions */}
                      <td>
                        <div className="cart-actions">
                          <a
                            className="btn btn-success btn-small"
                            href={order.waUrl || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`مراسلة ${name} عبر واتساب`}
                            onClick={(e) => {
                              if (!order.waUrl) {
                                e.preventDefault();
                                onOpenMessage?.(order);
                              }
                            }}
                            title="فتح محادثة واتساب مع العميل برابط المنتج فوراً"
                          >
                            <MessageCircle size={14} aria-hidden="true" />
                            واتساب
                          </a>
                          <Button
                            size="small"
                            variant="secondary"
                            icon={Edit3}
                            aria-label={`تعديل رسالة ${name}`}
                            onClick={() => onOpenMessage?.(order)}
                            title="تعديل نص الرسالة الموجهة لهذا العميل باليد"
                          >
                            كتابة رسالة
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
