import { useCallback, useMemo, useState } from "react";
import { RefreshCw, Search, ShoppingCart } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Select,
  Skeleton,
  TextInput,
} from "../ui/index.js";
import { useClipboard } from "../../hooks/ui/useClipboard.js";
import {
  useAbandonedCarts,
  useCartContacts,
  useRecoverySettings,
} from "../../hooks/cartRecovery/useCartRecovery.js";
import { useCouponsQuery } from "../../hooks/coupons/useCoupons.js";
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
} from "../../utils/cartRecovery/whatsappMessage.js";
import {
  COUPON_STATUS,
  getCouponStatus,
} from "../../utils/coupons/couponModel.js";
import CartRecoveryStats from "./CartRecoveryStats.jsx";
import AbandonedCartsTable from "./AbandonedCartsTable.jsx";
import CartDetailsModal from "./CartDetailsModal.jsx";
import WhatsAppTemplateCard from "./WhatsAppTemplateCard.jsx";

const EMPTY = [];

/**
 * Cart Recovery, stage 1: Salla's abandoned carts, a dashboard, cart
 * details and a manual WhatsApp reminder (wa.me) per cart. Nothing is sent
 * automatically; automatic campaigns need a backend (stage 2).
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

  const [search, setSearch] = useState("");
  const [includeRecent, setIncludeRecent] = useState(false);
  const [openCartId, setOpenCartId] = useState(null);

  const carts = query.data?.carts || EMPTY;
  const { abandonedAfter, locale } = settings;
  const thresholdLabel =
    ABANDONED_AFTER_OPTIONS.find((o) => o.value === abandonedAfter)?.label ||
    `${abandonedAfter} minutes`;

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
        ok ? "Recovery link copied" : "Couldn't copy the link",
        ok ? "success" : "error",
      );
    },
    [copy, showToast],
  );

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
        title="Could not load abandoned carts."
        action={
          <Button size="small" onClick={() => query.refetch()}>
            Retry
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
        title={carts.length ? "No carts match" : "No abandoned carts right now"}
        description={
          carts.length
            ? `Carts younger than ${thresholdLabel} are hidden. Tick "Show recent carts" or change the search.`
            : "Salla hasn't listed any abandoned carts for this store."
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
      />
    );
  }

  return (
    <div className="cart-recovery">
      <Card className="cart-panel">
        <Card.Header
          icon={ShoppingCart}
          title="Cart Recovery"
          subtitle="Abandoned carts from Salla. Remind customers on WhatsApp."
          actions={
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => query.refetch()}
              loading={query.isFetching && !query.isPending}
              disabled={query.isPending}
            >
              Refresh
            </Button>
          }
        />

        <div className="cart-body">
          <Alert tone="info">
            You send each reminder yourself: the WhatsApp button opens WhatsApp
            with the customer&apos;s number and a ready message. Salla may also
            send its own abandoned-cart reminders if they&apos;re enabled in
            your store.
          </Alert>

          {!query.isPending && !query.isError && (
            <CartRecoveryStats
              summary={summary}
              contactedCount={contactedCount}
              label={thresholdLabel}
            />
          )}
          {query.data?.truncated && (
            <Alert tone="warning">
              Showing the first {carts.length} carts; the numbers above cover
              those only.
            </Alert>
          )}

          <div className="cart-toolbar">
            <label className="cart-threshold">
              <span>Abandoned after</span>
              <Select
                aria-label="Abandoned after"
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
              label="Show recent carts"
              checked={includeRecent}
              onChange={setIncludeRecent}
            />
            <TextInput
              type="search"
              aria-label="Search carts"
              placeholder="Search name, phone or email"
              prefix={<Search size={14} aria-hidden="true" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {content}
        </div>
      </Card>

      <WhatsAppTemplateCard
        settings={{ ...settings, couponCode }}
        onChange={updateSettings}
        coupons={activeCoupons}
        couponsError={couponsQuery.isError}
      />

      {openCartId && (
        <CartDetailsModal
          cartId={openCartId}
          getToken={getToken}
          messageFor={messageFor}
          onClose={() => setOpenCartId(null)}
          onCopyLink={copyLink}
          onContacted={recordContact}
        />
      )}
    </div>
  );
}
