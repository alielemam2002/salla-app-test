import { useCallback, useMemo, useState } from "react";
import { RefreshCw, Search, Send, ShoppingCart } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  SegmentedTabs,
  Select,
  Skeleton,
  TextInput,
} from "../ui/index.js";
import { useClipboard } from "../../hooks/ui/useClipboard.js";
import {
  useAbandonedCarts,
  useApiSends,
  useCartContacts,
  useHiddenCarts,
  useRecoverySettings,
  useWhatsAppSender,
  useWhatsAppSettingsMutations,
  useWhatsAppStatus,
} from "../../hooks/cartRecovery/useCartRecovery.js";
import { useCouponsQuery } from "../../hooks/coupons/useCoupons.js";
import {
  ABANDONED_AFTER_OPTIONS,
  describeCartsError,
  isEligible,
  summarizeCarts,
  timeAgo,
} from "../../utils/cartRecovery/cartModel.js";
import {
  DEFAULT_TEMPLATES,
  cartMessageValues,
  renderTemplate,
  whatsappNumber,
} from "../../utils/cartRecovery/whatsappMessage.js";
import { recentlySent } from "../../utils/cartRecovery/recoveryStorage.js";
import {
  COUPON_STATUS,
  getCouponStatus,
} from "../../utils/coupons/couponModel.js";
import CartRecoveryStats from "./CartRecoveryStats.jsx";
import AbandonedCartsTable from "./AbandonedCartsTable.jsx";
import CartDetailsModal from "./CartDetailsModal.jsx";
import WhatsAppTemplateCard from "./WhatsAppTemplateCard.jsx";
import WhatsAppApiStatus from "./WhatsAppApiStatus.jsx";
import WhatsAppSettingsModal from "./WhatsAppSettingsModal.jsx";

const EMPTY = [];

/**
 * Cart Recovery, stage 1: Salla's abandoned carts, a dashboard, cart
 * details and a manual WhatsApp reminder (wa.me) per cart. When the
 * WhatsApp Cloud API is configured on the server, a "Send" button sends the
 * approved template instead (pressed by the merchant, one cart at a time).
 * Nothing is scheduled; automatic campaigns need a backend (stage 2).
 */
export default function CartRecoveryTab({ embedded, showToast }) {
  const getToken = useCallback(
    () => embedded?.auth?.getToken?.() || null,
    [embedded],
  );
  const query = useAbandonedCarts(getToken);
  const couponsQuery = useCouponsQuery(getToken);
  const [settings, updateSettings] = useRecoverySettings();
  const { contacts, recordContact } = useCartContacts();
  const { copy } = useClipboard();
  const waStatus = useWhatsAppStatus(getToken);
  const apiSends = useApiSends();
  const sender = useWhatsAppSender(getToken);
  const { toggle: toggleApi } = useWhatsAppSettingsMutations(getToken);
  // Connected to the merchant's own account AND switched on.
  const apiEnabled = Boolean(waStatus.data?.configured);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [includeRecent, setIncludeRecent] = useState(false);
  const [openCartId, setOpenCartId] = useState(null);
  const { hidden, hideCart, unhideCart } = useHiddenCarts();
  const [showHidden, setShowHidden] = useState(false);
  // Carts ticked for "send to selected" (ids).
  const [selected, setSelected] = useState(() => new Set());
  // { cart, sentAt, send } while asking to message a cart again within 24 h.
  const [resend, setResend] = useState(null);

  const allCarts = query.data?.carts || EMPTY;
  // Hidden carts are left out of the numbers too: the merchant set them aside.
  const carts = useMemo(
    () => allCarts.filter((cart) => !hidden[cart.id]),
    [allCarts, hidden],
  );
  const hiddenCount = allCarts.length - carts.length;
  const { abandonedAfter, locale } = settings;
  const thresholdLabel =
    ABANDONED_AFTER_OPTIONS.find((o) => o.value === abandonedAfter)?.label ||
    `${abandonedAfter} دقيقة`;

  const summary = useMemo(
    () => summarizeCarts(carts, abandonedAfter),
    [carts, abandonedAfter],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = showHidden ? allCarts : carts;
    return list.filter((cart) => {
      if (!includeRecent && !isEligible(cart, abandonedAfter)) return false;
      if (!q) return true;
      return [cart.customer?.name, cart.customer?.mobile, cart.customer?.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [allCarts, carts, showHidden, search, includeRecent, abandonedAfter]);

  const contactedCount = carts.filter(
    (cart) => isEligible(cart, abandonedAfter) && contacts[cart.id],
  ).length;

  // Active coupons from the Coupons feature (existing ones only).
  const activeCoupons = useMemo(
    () =>
      (couponsQuery.data || []).filter(
        (c) => getCouponStatus(c) === COUPON_STATUS.ACTIVE,
      ),
    [couponsQuery.data],
  );
  const couponCode = activeCoupons.some((c) => c.code === settings.couponCode)
    ? settings.couponCode
    : "";

  const template = settings.templates?.[locale] ?? DEFAULT_TEMPLATES[locale];
  const messageFor = useCallback(
    (cart) =>
      renderTemplate(template, cartMessageValues(cart, { locale, couponCode })),
    [template, locale, couponCode],
  );

  const copyLink = useCallback(
    async (cart) => {
      const ok = await copy(cart.checkout_url);
      showToast?.(
        ok ? "تم نسخ رابط الاسترجاع" : "تعذّر نسخ الرابط",
        ok ? "success" : "error",
      );
    },
    [copy, showToast],
  );

  const onApiResult = useCallback(
    (cart, result) =>
      showToast?.(
        result.success
          ? `قبلت Meta الرسالة الموجهة إلى ${cart.customer?.name || "العميل"}`
          : result.error || "تعذّر إرسال الرسالة",
        result.success ? "success" : "error",
      ),
    [showToast],
  );
  const sendMode = settings.sendMode === "text" ? "text" : "template";
  const api = apiEnabled
    ? {
        sender,
        sends: apiSends,
        couponCode,
        mode: sendMode,
        onResult: onApiResult,
        onConfirmResend: (cart, sentAt, send) =>
          setResend({ cart, sentAt, send }),
      }
    : null;

  // Why a cart can't be picked for "send to selected" (null = it can).
  const reasonFor = useCallback(
    (cart) =>
      !whatsappNumber(cart.customer?.mobile)
        ? "لا يوجد رقم جوال دولي لهذا العميل"
        : recentlySent(apiSends, cart.id)
          ? "أُرسلت لهذا العميل رسالة خلال آخر 24 ساعة"
          : null,
    [apiSends],
  );
  const selectable = visible.filter((cart) => !reasonFor(cart));
  const bulkTargets = selectable.filter((cart) => selected.has(cart.id));
  const selection = apiEnabled
    ? {
        isSelected: (id) => selected.has(id),
        toggle: (id) =>
          setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          }),
        reasonFor,
        allSelected:
          selectable.length > 0 &&
          selectable.every((cart) => selected.has(cart.id)),
        toggleAll: () =>
          setSelected((prev) =>
            selectable.length > 0 &&
            selectable.every((cart) => prev.has(cart.id))
              ? new Set()
              : new Set(selectable.map((cart) => cart.id)),
          ),
        locked: Boolean(sender.batch?.running),
      }
    : null;

  const startBulk = async () => {
    setConfirmBulk(false);
    const result = await sender.sendMany(bulkTargets, couponCode, {
      mode: sendMode,
      textFor: messageFor,
    });
    setSelected(new Set());
    showToast?.(
      `قبلت Meta ${result.sent} من ${result.total} رسالة${result.failed ? `، وفشل إرسال ${result.failed}` : ""}.`,
      result.failed ? "warning" : "success",
    );
  };

  let content;
  if (query.isPending) {
    content = (
      <div className="cart-loading" aria-busy="true">
        {[1, 2, 3, 4].map((n) => (
          <Skeleton key={n} height={40} />
        ))}
      </div>
    );
  } else if (query.isError) {
    content = (
      <Alert
        tone="error"
        title="تعذّر تحميل السلات المتروكة"
        action={
          <Button size="small" onClick={() => query.refetch()}>
            إعادة المحاولة
          </Button>
        }
      >
        {describeCartsError(query.error.result)}
      </Alert>
    );
  } else if (!visible.length) {
    content = (
      <EmptyState
        icon={ShoppingCart}
        title={
          carts.length ? "لا توجد سلات مطابقة" : "لا توجد سلات متروكة حاليًا"
        }
        description={
          carts.length
            ? `السلات الأحدث من ${thresholdLabel} مخفية. فعّل «إظهار السلات الحديثة» أو غيّر كلمة البحث.`
            : "لم تعرض سلة أي سلات متروكة لهذا المتجر. ستظهر هنا عندما يترك العملاء منتجات في سلاتهم."
        }
      />
    );
  } else {
    content = (
      <AbandonedCartsTable
        carts={visible}
        abandonedAfter={abandonedAfter}
        contacts={contacts}
        messageFor={messageFor}
        onView={(cart) => setOpenCartId(cart.id)}
        onCopyLink={copyLink}
        onContacted={recordContact}
        api={api}
        selection={selection}
        hidden={hidden}
        onHide={(id) => {
          hideCart(id);
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          showToast?.(
            "تم إخفاء السلة من القائمة. يمكنك إظهارها من «إظهار المخفية».",
            "info",
          );
        }}
        onUnhide={unhideCart}
      />
    );
  }

  return (
    <div className="cart-recovery">
      <Card className="cart-panel">
        <Card.Header
          icon={ShoppingCart}
          title="السلات المتروكة"
          subtitle="تابع السلات المتروكة في متجرك وذكّر العملاء عبر واتساب."
          actions={
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => query.refetch()}
              loading={query.isFetching && !query.isPending}
              disabled={query.isPending}
            >
              تحديث
            </Button>
          }
        />

        <div className="cart-body">
          <Alert tone="info">
            زر <strong>واتساب</strong> يفتح محادثة برسالة جاهزة ترسلها بنفسك
            (الإرسال اليدوي). زر <strong>إرسال</strong> (بعد ربط واتساب) يرسل
            القالب المعتمد من التطبيق مباشرة. وقد ترسل سلة تذكيراتها الخاصة
            أيضًا إذا كانت مفعّلة في متجرك.
          </Alert>

          <WhatsAppApiStatus
            status={waStatus}
            onOpenSettings={() => setSettingsOpen(true)}
            toggling={toggleApi.isPending}
            onToggle={(enabled) =>
              toggleApi.mutate(enabled, {
                onSuccess: () =>
                  showToast?.(
                    enabled
                      ? "تم تفعيل الإرسال من التطبيق"
                      : "تم إيقاف الإرسال من التطبيق: الإرسال اليدوي فقط",
                    "success",
                  ),
                onError: (error) =>
                  showToast?.(
                    error.result?.error || "تعذّر تغيير الإعداد",
                    "error",
                  ),
              })
            }
          />

          {!query.isPending && !query.isError && (
            <CartRecoveryStats
              summary={summary}
              contactedCount={contactedCount}
              label={thresholdLabel}
            />
          )}
          {query.data?.truncated && (
            <Alert tone="warning">
              يتم عرض أول {carts.length} سلة فقط، والأرقام أعلاه تخص هذه السلات
              فقط.
            </Alert>
          )}

          <div className="cart-toolbar">
            <label className="cart-threshold">
              <span>تعتبر متروكة بعد</span>
              <Select
                aria-label="تعتبر متروكة بعد"
                value={String(abandonedAfter)}
                onChange={(e) =>
                  updateSettings({ abandonedAfter: Number(e.target.value) })
                }
                options={ABANDONED_AFTER_OPTIONS.map((o) => ({
                  value: String(o.value),
                  label: o.label,
                }))}
              />
            </label>
            <Checkbox
              label="إظهار السلات الحديثة"
              checked={includeRecent}
              onChange={setIncludeRecent}
            />
            {hiddenCount > 0 && (
              <Checkbox
                label={`إظهار المخفية (${hiddenCount})`}
                checked={showHidden}
                onChange={setShowHidden}
              />
            )}
            <TextInput
              type="search"
              aria-label="بحث في السلات"
              placeholder="بحث بالاسم أو الجوال أو البريد"
              prefix={<Search size={14} aria-hidden="true" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {apiEnabled && (
            <div className="cart-send-mode">
              <span className="form-label">
                نوع الرسالة عند الإرسال من التطبيق
              </span>
              <SegmentedTabs
                variant="pill"
                ariaLabel="نوع الرسالة"
                tabs={[
                  { id: "template", label: "قالب معتمد" },
                  { id: "text", label: "رسالة نصية" },
                ]}
                activeTab={sendMode}
                onTabChange={(mode) => updateSettings({ sendMode: mode })}
              />
              <p className="form-hint">
                {sendMode === "text"
                  ? "تُرسل الرسالة المكتوبة في «رسالة واتساب» بالأسفل كنص عادي. تصل فقط إذا راسلك العميل خلال آخر 24 ساعة؛ غير ذلك سيرفضها واتساب ويظهر السبب بجانب السلة."
                  : `يُرسل القالب المعتمد «${waStatus.data?.template || ""}». يصل لأي عميل في أي وقت.`}
              </p>
            </div>
          )}

          {apiEnabled && !query.isPending && !query.isError && (
            <div className="cart-bulk">
              {sender.batch?.running ? (
                <>
                  <span aria-live="polite">
                    جارٍ الإرسال {sender.batch.done} / {sender.batch.total}…
                  </span>
                  <Button size="small" variant="danger" onClick={sender.stop}>
                    إيقاف
                  </Button>
                </>
              ) : (
                <Button
                  size="small"
                  variant="primary"
                  icon={Send}
                  onClick={() => setConfirmBulk(true)}
                  disabled={!bulkTargets.length}
                  title={
                    bulkTargets.length
                      ? undefined
                      : "حدّد السلات التي تريد مراسلتها من الجدول"
                  }
                >
                  إرسال إلى المحدد ({bulkTargets.length})
                </Button>
              )}
              {sender.batch && !sender.batch.running && (
                <span className="cart-bulk-summary">
                  آخر عملية: {sender.batch.sent} قبلتها Meta،{" "}
                  {sender.batch.failed} فشلت
                  {sender.batch.stopped ? " (تم الإيقاف)" : ""}.
                </span>
              )}
            </div>
          )}

          {content}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={startBulk}
        tone="default"
        title="إرسال تذكيرات واتساب"
        confirmText={`إرسال إلى ${bulkTargets.length}`}
        cancelText="إلغاء"
      >
        <p>
          {sendMode === "text" ? (
            <>
              سيتم إرسال رسالتك كنص عادي إلى {bulkTargets.length} عميل، واحدًا
              تلو الآخر. تصل فقط للعملاء الذين راسلوك خلال آخر 24 ساعة.
            </>
          ) : (
            <>
              سيتم إرسال القالب{" "}
              <strong dir="ltr">{waStatus.data?.template}</strong> إلى{" "}
              {bulkTargets.length} عميل، واحدًا تلو الآخر.
            </>
          )}{" "}
        </p>
      </ConfirmDialog>

      <WhatsAppTemplateCard
        settings={{ ...settings, couponCode }}
        onChange={updateSettings}
        coupons={activeCoupons}
        couponsError={couponsQuery.isError}
      />

      {settingsOpen && (
        <WhatsAppSettingsModal
          getToken={getToken}
          onClose={() => setSettingsOpen(false)}
          showToast={showToast}
        />
      )}

      {openCartId && (
        <CartDetailsModal
          cartId={openCartId}
          getToken={getToken}
          messageFor={messageFor}
          onClose={() => setOpenCartId(null)}
          onCopyLink={copyLink}
          onContacted={recordContact}
          api={api}
        />
      )}

      {/* After the details modal so it shows on top of it. */}
      <ConfirmDialog
        isOpen={Boolean(resend)}
        onClose={() => setResend(null)}
        onConfirm={() => {
          const { send } = resend;
          setResend(null);
          send();
        }}
        tone="default"
        title="إرسال رسالة أخرى؟"
        confirmText="إرسال مرة أخرى"
        cancelText="إلغاء"
      >
        <p>
          أُرسلت إلى {resend?.cart.customer?.name || "هذا العميل"} رسالة من
          التطبيق{" "}
          {resend?.sentAt ? timeAgo(Date.parse(resend.sentAt)) : "مؤخرًا"}.
          الرسائل المتكررة في وقت قصير قد تزعج العميل وتجعل واتساب يعتبرها
          مزعجة.
        </p>
      </ConfirmDialog>
    </div>
  );
}
