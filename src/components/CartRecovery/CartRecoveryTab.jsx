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
  useRecoverySettings,
  useWhatsAppSender,
  useWhatsAppSettingsMutations,
  useWhatsAppStatus,
} from "../../hooks/cartRecovery/useCartRecovery.js";
import { useCouponsQuery } from "../../hooks/coupons/useCoupons.js";
import { useEmbeddedSignup } from "../../hooks/whatsapp/useEmbeddedSignup.js";
import {
  ABANDONED_AFTER_OPTIONS,
  describeCartsError,
  isEligible,
  summarizeCarts,
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
import CartTemplateModal from "./CartTemplateModal.jsx";
import EmbeddedSignupNotice from "../whatsapp/EmbeddedSignupNotice.jsx";

const EMPTY = [];

/**
 * Cart Recovery, stage 1: Salla's abandoned carts, a dashboard, cart
 * details and a manual WhatsApp reminder (wa.me) per cart. When the
 * WhatsApp Cloud API is configured on the server, a "Send" button sends the
 * approved template instead (pressed by the merchant, one cart at a time).
 * Nothing is scheduled; automatic campaigns need a backend (stage 2).
 */
export default function CartRecoveryTab({ embedded, showToast, onNavigate }) {
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
  // "Connect WhatsApp with Facebook" (Meta Embedded Signup).
  const signup = useEmbeddedSignup(getToken);
  // Connected to the merchant's own account AND switched on.
  const apiEnabled = Boolean(waStatus.data?.configured);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [includeRecent, setIncludeRecent] = useState(false);
  const [openCartId, setOpenCartId] = useState(null);

  const carts = query.data?.carts || EMPTY;
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
    return carts.filter((cart) => {
      if (!includeRecent && !isEligible(cart, abandonedAfter)) return false;
      if (!q) return true;
      return [cart.customer?.name, cart.customer?.mobile, cart.customer?.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [carts, search, includeRecent, abandonedAfter]);

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
      }
    : null;

  // Carts the bulk send would actually message.
  const bulkTargets = visible.filter(
    (cart) =>
      isEligible(cart, abandonedAfter) &&
      whatsappNumber(cart.customer?.mobile) &&
      !recentlySent(apiSends, cart.id),
  );
  const startBulk = async () => {
    setConfirmBulk(false);
    const result = await sender.sendMany(bulkTargets, couponCode, {
      mode: sendMode,
      textFor: messageFor,
    });
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
            signup={signup}
            onOpenTemplate={() => setSettingsOpen(true)}
            onOpenSettings={() => onNavigate?.("settings")}
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
          <EmbeddedSignupNotice signup={signup} />

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
                      : "لا توجد سلة معروضة يمكن مراسلتها: إما بلا رقم دولي أو تمت مراسلتها خلال آخر 24 ساعة"
                  }
                >
                  إرسال إلى {bulkTargets.length} سلة معروضة
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
          تُتخطى السلات التي بلا رقم جوال دولي أو التي تمت مراسلتها من التطبيق
          خلال آخر 24 ساعة.
        </p>
      </ConfirmDialog>

      <WhatsAppTemplateCard
        settings={{ ...settings, couponCode }}
        onChange={updateSettings}
        coupons={activeCoupons}
        couponsError={couponsQuery.isError}
      />

      {settingsOpen && (
        <CartTemplateModal
          getToken={getToken}
          onClose={() => setSettingsOpen(false)}
          onOpenSettings={() => {
            setSettingsOpen(false);
            onNavigate?.("settings");
          }}
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
    </div>
  );
}
