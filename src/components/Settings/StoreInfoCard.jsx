import { RefreshCw, Store } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  KeyValueList,
  Skeleton,
} from "../ui/index.js";
import {
  ENTITY_LABELS,
  PLAN_LABELS,
  STORE_STATUS,
  formatDate,
} from "../../utils/settings/settingsLabels.js";
import { storeAccessMessage } from "../../utils/sallaAccess.js";

const yesNo = (value) =>
  value === null || value === undefined ? null : value ? "نعم" : "لا";

const ltr = (value) => (value ? <span dir="ltr">{value}</span> : null);

function StoreHeader({ store }) {
  const status = STORE_STATUS[store.status];
  return (
    <div className="settings-store-head">
      {store.avatar && (
        <img className="settings-store-avatar" src={store.avatar} alt="" />
      )}
      <div className="settings-store-title">
        <h3>{store.name || store.username}</h3>
        {store.domain && (
          <a href={store.domain} target="_blank" rel="noreferrer" dir="ltr">
            {store.domain}
          </a>
        )}
      </div>
      <div className="settings-badges">
        {store.plan && (
          <Badge tone="primary">
            باقة {PLAN_LABELS[store.plan] || store.plan}
          </Badge>
        )}
        {store.status && (
          <Badge tone={status?.tone || "neutral"} dot>
            {status?.label || store.status}
          </Badge>
        )}
        <Badge tone={store.verified ? "success" : "neutral"}>
          {store.verified ? "موثّق" : "غير موثّق"}
        </Badge>
      </div>
    </div>
  );
}

function AccessDetails({ access }) {
  return (
    <div className="settings-section">
      <h4>صلاحية التطبيق على المتجر</h4>
      <KeyValueList
        items={[
          { label: "الحالة", value: "مربوط", mono: false, tone: "success" },
          {
            label: "تتجدد تلقائيًا قبل",
            value: formatDate(access.expiresAt),
            mono: false,
          },
          {
            label: "التجديد التلقائي",
            value: access.offlineAccess ? "مفعّل" : "غير مفعّل",
            mono: false,
            tone: access.offlineAccess ? undefined : "danger",
          },
        ]}
      />
      {access.scopes?.length > 0 && (
        <ul className="settings-chips" aria-label="صلاحيات التطبيق">
          {access.scopes.map((scope) => (
            <li key={scope} dir="ltr">
              {scope}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Everything Salla tells us about the store (GET /store/info and the
 * account's user/info), and whether the app holds the store's tokens.
 */
export default function StoreInfoCard({ query }) {
  let content;
  if (query.isPending) {
    content = <Skeleton height={160} />;
  } else if (query.isError) {
    content = (
      <Alert tone="error" title="تعذّر تحميل بيانات المتجر">
        {storeAccessMessage(query.error.result?.code) ||
          query.error.result?.error}
      </Alert>
    );
  } else {
    const { access, store, user, errors = {} } = query.data;
    if (!access?.authorized) {
      content = (
        <Alert tone="warning" title="المتجر غير مربوط بالتطبيق">
          {storeAccessMessage(
            access?.revoked ? "token_expired" : "store_not_authorized",
          )}
        </Alert>
      );
    } else {
      const licenses = store?.licenses || {};
      const merchant = user?.merchant || {};
      const branch = store?.branch;
      content = (
        <>
          {store && <StoreHeader store={store} />}
          {errors.store && <Alert tone="warning">{errors.store}</Alert>}
          {store && (
            <KeyValueList
              items={[
                { label: "رقم المتجر", value: store.id },
                { label: "اسم المستخدم", value: ltr(store.username) },
                {
                  label: "نوع النشاط",
                  value: ENTITY_LABELS[store.entity] || store.entity,
                  mono: false,
                },
                { label: "العملة", value: store.currency },
                { label: "البريد", value: ltr(store.email) },
                { label: "الجوال", value: ltr(store.mobile || store.phone) },
                {
                  label: "السجل التجاري",
                  value:
                    licenses.commercial_number || merchant.commercial_number,
                },
                {
                  label: "الرقم الضريبي",
                  value: licenses.tax_number || merchant.tax_number,
                },
                {
                  label: "وثيقة العمل الحر",
                  value: licenses.freelance_number,
                },
                {
                  label: "تاريخ الإنشاء",
                  value: formatDate(store.created_at),
                  mono: false,
                },
                { label: "المالك", value: store.owner?.name, mono: false },
              ]}
            />
          )}
          {store?.about && <p className="settings-about">{store.about}</p>}
          {branch && (
            <div className="settings-section">
              <h4>الفرع الرئيسي</h4>
              <KeyValueList
                items={[
                  { label: "الاسم", value: branch.name, mono: false },
                  {
                    label: "المدينة",
                    value: [branch.city, branch.country]
                      .filter(Boolean)
                      .join("، "),
                    mono: false,
                  },
                  { label: "العنوان", value: branch.address, mono: false },
                  { label: "الرمز البريدي", value: branch.postalCode },
                  { label: "الهاتف", value: ltr(branch.phone) },
                  { label: "واتساب الفرع", value: ltr(branch.whatsapp) },
                  {
                    label: "الدفع عند الاستلام",
                    value: yesNo(branch.codAvailable),
                    mono: false,
                  },
                ]}
              />
            </div>
          )}
          {user && (
            <div className="settings-section">
              <h4>حساب سلة المرتبط</h4>
              <KeyValueList
                items={[
                  { label: "الاسم", value: user.name, mono: false },
                  { label: "البريد", value: ltr(user.email) },
                  { label: "الجوال", value: ltr(user.mobile) },
                  { label: "الدور", value: user.role },
                ]}
              />
            </div>
          )}
          {errors.user && <Alert tone="warning">{errors.user}</Alert>}
          <AccessDetails access={access} />
        </>
      );
    }
  }

  return (
    <Card>
      <Card.Header
        icon={Store}
        title="معلومات المتجر"
        subtitle="بيانات متجرك كما تسجّلها سلة."
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
      <div className="settings-body">{content}</div>
    </Card>
  );
}
