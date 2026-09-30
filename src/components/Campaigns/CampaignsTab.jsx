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
  name: z.string().trim().min(1, "اكتب اسمًا للحملة"),
  template: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,512}$/, "أحرف إنجليزية صغيرة وأرقام و _ فقط"),
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, "رمز لغة مثل ar أو en_US"),
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
                p.source === "coupon_code" ? "اختر كوبونًا" : "اكتب النص",
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
      `قبلت Meta ${result.sent} من ${result.total} رسالة${result.failed ? `، وفشل إرسال ${result.failed}` : ""}.`,
      result.failed ? "warning" : "success",
    );
  };

  let status;
  if (waStatus.isPending) status = null;
  else if (!waStatus.data?.connected) {
    status = (
      <Alert tone="info" title="اربط واتساب أولًا">
        تُرسل الحملات من حساب واتساب للأعمال الخاص بك. اربطه من تبويب «السلات
        المتروكة» ← «إعدادات واتساب».
      </Alert>
    );
  } else if (!waStatus.data?.enabled) {
    status = (
      <Alert tone="info" title="الإرسال من التطبيق متوقف">
        فعّل «الإرسال من التطبيق» من تبويب «السلات المتروكة» لتتمكن من إرسال
        الحملات.
      </Alert>
    );
  } else {
    status = (
      <Alert tone="success" title="الإرسال من حساب واتساب الخاص بك">
        {waStatus.data.profile?.verifiedName || "واتساب للأعمال"}
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
        title="تعذّر تحميل العملاء"
        action={
          <Button size="small" onClick={() => customersQuery.refetch()}>
            إعادة المحاولة
          </Button>
        }
      >
        {customersQuery.error.result?.code === "missing_scope" ||
        customersQuery.error.result?.status === 403
          ? "يحتاج التطبيق إلى صلاحية customers.read (قراءة العملاء). أضفها من بوابة الشركاء، ثم أعد تثبيت التطبيق وحدّث SALLA_ACCESS_TOKEN."
          : describeCartsError(customersQuery.error.result)}
      </Alert>
    );
  } else if (!customers.length) {
    recipientsContent = (
      <EmptyState icon={Megaphone} title="لا يوجد عملاء بعد" />
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
          title="حملات واتساب"
          subtitle="أرسل عرضًا أو كود خصم إلى العملاء الذين تختارهم."
          actions={
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => customersQuery.refetch()}
              loading={customersQuery.isFetching && !customersQuery.isPending}
              disabled={customersQuery.isPending || running}
            >
              تحديث العملاء
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
          title="المستلمون"
          subtitle="يمكن تحديد العملاء القادرين على استقبال رسائل واتساب فقط."
        />
        <div className="cart-body">
          {customersQuery.data?.truncated && (
            <Alert tone="warning">
              يتم عرض أول {customers.length} عميل فقط.
            </Alert>
          )}
          {recipientsContent}

          <div className="campaign-sendbar">
            {running ? (
              <>
                <span aria-live="polite">
                  جارٍ الإرسال {run.done} / {run.total}…
                </span>
                <Button variant="danger" size="small" onClick={sender.stop}>
                  إيقاف
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
                    ? "اربط واتساب وفعّل الإرسال من التطبيق أولًا"
                    : !recipients.length
                      ? "حدّد عميلًا واحدًا على الأقل"
                      : undefined
                }
              >
                مراجعة وإرسال إلى {recipients.length}
              </Button>
            )}
            {run && !run.running && (
              <span className="cart-bulk-summary">
                آخر عملية: {run.sent} قبلتها Meta، {run.failed} فشلت
                {run.stopped ? " (تم الإيقاف)" : ""}.
              </span>
            )}
          </div>
          {run?.fatal && !run.running && (
            <Alert tone="error" title="توقفت الحملة">
              {run.fatal}
            </Alert>
          )}
        </div>
      </Card>

      {history.length > 0 && (
        <Card className="cart-panel">
          <Card.Header
            icon={History}
            title="الحملات السابقة"
            subtitle="من هذا المتصفح."
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
                  {c.sent}/{c.total} قبلتها Meta
                  {c.stopped ? " · تم الإيقاف" : ""}
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
        title={`إرسال «${review?.name || ""}»`}
        confirmText={`إرسال إلى ${recipients.length}`}
        cancelText="إلغاء"
      >
        {review && (
          <div className="campaign-review">
            <p>
              سيتم إرسال القالب <code dir="ltr">{review.template}</code> (
              <span dir="ltr">{review.language}</span>) إلى{" "}
              <strong>{recipients.length}</strong> عميل، واحدًا تلو الآخر. أبقِ
              هذه الصفحة مفتوحة حتى تنتهي العملية.
            </p>
            {review.params.length > 0 && (
              <ul>
                {describeVariables(review).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <p className="form-hint">
              تحدّ Meta عدد العملاء المختلفين الذين يمكن لحساب واتساب جديد
              مراسلتهم يوميًا؛ وتُرفض الرسائل الزائدة حتى يرتفع الحد.
            </p>
            <Checkbox
              label="وافق هؤلاء العملاء على استقبال رسائل واتساب من متجري."
              checked={consent}
              onChange={setConsent}
            />
            {!consent && (
              <p className="form-hint">
                يسمح واتساب بالرسائل التسويقية للعملاء الذين وافقوا على
                استقبالها فقط. فعّل الخيار أعلاه لتتمكن من الإرسال.
              </p>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
