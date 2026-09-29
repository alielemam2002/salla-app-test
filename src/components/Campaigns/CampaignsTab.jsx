import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { History, Megaphone, RefreshCw, Send } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Skeleton,
} from "../ui/index.js";
import {
  useCampaignLog,
  useCampaignSender,
  useCustomerGroups,
  useCustomers,
} from "../../hooks/campaigns/useCampaigns.js";
import { useWhatsAppStatus } from "../../hooks/cartRecovery/useCartRecovery.js";
import { useCouponsQuery } from "../../hooks/coupons/useCoupons.js";
import {
  describeVariables,
  filterCustomers,
  formToCampaign,
  ineligibleReason,
} from "../../utils/campaigns/campaignModel.js";
import { describeCartsError } from "../../utils/cartRecovery/cartModel.js";
import {
  COUPON_STATUS,
  getCouponStatus,
} from "../../utils/coupons/couponModel.js";
import CampaignForm from "./CampaignForm.jsx";
import RecipientsTable from "./RecipientsTable.jsx";

const schema = z.object({
  name: z.string().trim().min(1, "Give the campaign a name"),
  template: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,512}$/, "Lowercase letters, numbers and _ only"),
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, "A language code like ar or en_US"),
  params: z
    .array(
      z
        .object({ source: z.string(), value: z.string().optional() })
        .superRefine((p, ctx) => {
          if (p.source !== "customer_name" && !String(p.value || "").trim()) {
            ctx.addIssue({
              code: "custom",
              path: ["value"],
              message:
                p.source === "coupon_code"
                  ? "Choose a coupon"
                  : "Enter the text",
            });
          }
        }),
    )
    .max(10),
});

const DEFAULTS = {
  name: "",
  template: "",
  language: "ar",
  params: [{ source: "customer_name", value: "" }],
};

const EMPTY = [];

/**
 * WhatsApp campaigns: send an approved template (an offer, a promo code…)
 * to the customers the merchant picks. Uses the merchant's own WhatsApp
 * account and its "Send from the app" switch (Cart Recovery → WhatsApp
 * settings). Messages go one at a time from this browser.
 */
export default function CampaignsTab({ embedded, showToast }) {
  const getToken = useCallback(
    () => embedded?.auth?.getToken?.() || null,
    [embedded],
  );
  const customersQuery = useCustomers(getToken);
  const groupsQuery = useCustomerGroups(getToken);
  const couponsQuery = useCouponsQuery(getToken);
  const waStatus = useWhatsAppStatus(getToken);
  const sender = useCampaignSender(getToken);
  const history = useCampaignLog();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [review, setReview] = useState(null); // validated campaign
  const [consent, setConsent] = useState(false);

  const customers = customersQuery.data?.customers || EMPTY;
  const groups = groupsQuery.data || EMPTY;
  const visible = useMemo(
    () => filterCustomers(customers, { search, groupId }),
    [customers, search, groupId],
  );
  const recipients = useMemo(
    () => customers.filter((c) => selected.has(c.id) && !ineligibleReason(c)),
    [customers, selected],
  );
  const activeCoupons = useMemo(
    () =>
      (couponsQuery.data || []).filter(
        (c) => getCouponStatus(c) === COUPON_STATUS.ACTIVE,
      ),
    [couponsQuery.data],
  );

  const canSend = Boolean(waStatus.data?.configured);
  const running = Boolean(sender.run?.running);

  const toggle = useCallback(
    (id) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const selectVisible = (list) =>
    setSelected((prev) => new Set([...prev, ...list.map((c) => c.id)]));

  const openReview = form.handleSubmit((values) => {
    setConsent(false);
    setReview(formToCampaign(values));
  });

  const send = async () => {
    const campaign = review;
    setReview(null);
    const result = await sender.start(campaign, recipients);
    showToast?.(
      `Meta accepted ${result.sent} of ${result.total} messages${result.failed ? `, ${result.failed} failed` : ""}.`,
      result.failed ? "warning" : "success",
    );
  };

  let status;
  if (waStatus.isPending) status = null;
  else if (!waStatus.data?.connected) {
    status = (
      <Alert tone="info" title="Connect WhatsApp first">
        Campaigns send from your own WhatsApp Business account. Connect it in
        Cart Recovery → WhatsApp settings.
      </Alert>
    );
  } else if (!waStatus.data?.enabled) {
    status = (
      <Alert tone="info" title="Sending from the app is switched off">
        Turn on &quot;Send from the app&quot; in Cart Recovery to send
        campaigns.
      </Alert>
    );
  } else {
    status = (
      <Alert tone="success" title="Sending from your WhatsApp account">
        {waStatus.data.profile?.verifiedName || "WhatsApp Business"}
        {waStatus.data.profile?.displayPhone && (
          <>
            {" "}
            · <span dir="ltr">{waStatus.data.profile.displayPhone}</span>
          </>
        )}
      </Alert>
    );
  }

  let recipientsContent;
  if (customersQuery.isPending) {
    recipientsContent = (
      <div className="cart-loading" aria-busy="true">
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} height={36} />
        ))}
      </div>
    );
  } else if (customersQuery.isError) {
    recipientsContent = (
      <Alert
        tone="error"
        title="Could not load customers."
        action={
          <Button size="small" onClick={() => customersQuery.refetch()}>
            Retry
          </Button>
        }
      >
        {customersQuery.error.result?.code === "missing_scope" ||
        customersQuery.error.result?.status === 403
          ? "The app needs the customers.read scope. Add it in the Partners Portal, reinstall the app, and update SALLA_ACCESS_TOKEN."
          : describeCartsError(customersQuery.error.result)}
      </Alert>
    );
  } else if (!customers.length) {
    recipientsContent = (
      <EmptyState icon={Megaphone} title="No customers yet" />
    );
  } else {
    recipientsContent = (
      <RecipientsTable
        customers={customers}
        visible={visible}
        groups={groups}
        search={search}
        onSearch={setSearch}
        groupId={groupId}
        onGroup={setGroupId}
        selected={selected}
        onToggle={toggle}
        onSelectVisible={selectVisible}
        onClear={() => setSelected(new Set())}
        results={sender.run?.results}
        locked={running}
      />
    );
  }

  const run = sender.run;
  return (
    <div className="campaigns">
      <Card className="cart-panel">
        <Card.Header
          icon={Megaphone}
          title="WhatsApp Campaigns"
          subtitle="Send an offer or a promo code to the customers you choose."
          actions={
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => customersQuery.refetch()}
              loading={customersQuery.isFetching && !customersQuery.isPending}
              disabled={customersQuery.isPending || running}
            >
              Refresh customers
            </Button>
          }
        />
        <div className="cart-body">
          {status}
          <CampaignForm
            form={form}
            coupons={activeCoupons}
            disabled={running}
          />
        </div>
      </Card>

      <Card className="cart-panel">
        <Card.Header
          icon={Send}
          title="Recipients"
          subtitle="Only customers who can receive WhatsApp messages can be selected."
        />
        <div className="cart-body">
          {customersQuery.data?.truncated && (
            <Alert tone="warning">
              Showing the first {customers.length} customers.
            </Alert>
          )}
          {recipientsContent}

          <div className="campaign-sendbar">
            {running ? (
              <>
                <span aria-live="polite">
                  Sending {run.done} / {run.total}…
                </span>
                <Button variant="danger" size="small" onClick={sender.stop}>
                  Stop
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                icon={Send}
                onClick={openReview}
                disabled={!canSend || !recipients.length}
                title={
                  !canSend
                    ? "Connect WhatsApp and turn on sending from the app first"
                    : !recipients.length
                      ? "Select at least one customer"
                      : undefined
                }
              >
                Review & send to {recipients.length}
              </Button>
            )}
            {run && !run.running && (
              <span className="cart-bulk-summary">
                Last run: {run.sent} accepted by Meta, {run.failed} failed
                {run.stopped ? " (stopped)" : ""}.
              </span>
            )}
          </div>
          {run?.fatal && !run.running && (
            <Alert tone="error" title="The campaign stopped.">
              {run.fatal}
            </Alert>
          )}
        </div>
      </Card>

      {history.length > 0 && (
        <Card className="cart-panel">
          <Card.Header
            icon={History}
            title="Recent campaigns"
            subtitle="From this browser."
          />
          <ul className="campaign-history">
            {history.map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong>
                <span dir="ltr">
                  <code>{c.template}</code>
                </span>
                <span>{new Date(c.at).toLocaleString()}</span>
                <Badge tone={c.failed ? "warning" : "success"}>
                  {c.sent}/{c.total} accepted
                  {c.stopped ? " · stopped" : ""}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        isOpen={Boolean(review)}
        onClose={() => setReview(null)}
        onConfirm={send}
        confirmDisabled={!consent}
        tone="default"
        title={`Send "${review?.name || ""}"`}
        confirmText={`Send to ${recipients.length}`}
        cancelText="Cancel"
      >
        {review && (
          <div className="campaign-review">
            <p>
              Template <code>{review.template}</code> ({review.language}) to{" "}
              <strong>{recipients.length}</strong> customers, one at a time.
              Keep this tab open until it finishes.
            </p>
            {review.params.length > 0 && (
              <ul>
                {describeVariables(review).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <p className="form-hint">
              Meta limits how many different customers a new WhatsApp account
              can message per day; the rest are rejected until the limit rises.
            </p>
            <Checkbox
              label="These customers agreed to receive WhatsApp messages from my store."
              checked={consent}
              onChange={setConsent}
            />
            {!consent && (
              <p className="form-hint">
                WhatsApp only allows marketing messages to customers who opted
                in. Tick the box to send.
              </p>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
