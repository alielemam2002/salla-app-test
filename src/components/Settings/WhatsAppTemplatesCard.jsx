import { useMemo, useState } from "react";
import { FileText, RefreshCw, Search } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  SegmentedTabs,
  Skeleton,
  TextInput,
} from "../ui/index.js";
import {
  TEMPLATE_CATEGORY,
  TEMPLATE_STATUS,
} from "../../utils/settings/settingsLabels.js";
import { timeAgo } from "../../utils/cartRecovery/cartModel.js";

function TemplateItem({ template }) {
  const status = TEMPLATE_STATUS[template.status];
  const { header, body, buttons } = template.variables;
  const count = header.length + body.length + buttons;
  return (
    <li className="settings-template">
      <div className="settings-template-head">
        <code dir="ltr">{template.name}</code>
        <span className="form-hint" dir="ltr">
          {template.language}
        </span>
        <Badge tone={status?.tone || "neutral"} dot>
          {status?.label || template.status}
        </Badge>
        <Badge tone="neutral">
          {TEMPLATE_CATEGORY[template.category] || template.category}
        </Badge>
      </div>
      {template.header?.text && (
        <p className="settings-template-header" dir="auto">
          {template.header.text}
        </p>
      )}
      {template.body && (
        <p className="settings-template-body" dir="auto">
          {template.body}
        </p>
      )}
      {template.footer && (
        <p className="form-hint" dir="auto">
          {template.footer}
        </p>
      )}
      {template.buttons.length > 0 && (
        <ul className="settings-template-buttons">
          {template.buttons.map((button, i) => (
            <li key={`${button.type}-${i}`}>
              {button.text}
              {button.url && (
                <span className="form-hint" dir="ltr">
                  {" "}
                  {button.url}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="form-hint">
        {count
          ? `يحتاج ${count} ${count === 1 ? "قيمة" : "قيم"} عند الإرسال${buttons ? " (منها رابط الزر)" : ""}.`
          : "بلا متغيرات."}
      </p>
    </li>
  );
}

/**
 * The merchant's templates, read from Meta (not typed by hand). Features
 * will pick from this list (stage 2).
 */
export default function WhatsAppTemplatesCard({ query, sync, account }) {
  const [filter, setFilter] = useState("approved");
  const [search, setSearch] = useState("");
  const templates = query.data?.templates;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (templates || []).filter(
      (t) =>
        (filter === "all" || t.status === "APPROVED") &&
        (!q ||
          t.name.toLowerCase().includes(q) ||
          t.body.toLowerCase().includes(q)),
    );
  }, [templates, filter, search]);

  const connected = Boolean(account?.tokenLast4);
  let content;
  if (!connected) {
    content = (
      <EmptyState
        icon={FileText}
        title="اربط حساب واتساب أولًا"
        description="بعد ربط الحساب ومعرّف WABA تظهر هنا كل قوالبك من Meta بحالتها ونصها."
      />
    );
  } else if (query.isPending) {
    content = <Skeleton height={120} />;
  } else if (query.isError) {
    content = <Alert tone="error">{query.error.result?.error}</Alert>;
  } else {
    const approved = templates.filter((t) => t.status === "APPROVED").length;
    content = (
      <>
        {sync.isError && <Alert tone="error">{sync.error.result?.error}</Alert>}
        <div className="settings-toolbar">
          <SegmentedTabs
            variant="pill"
            ariaLabel="تصفية القوالب"
            tabs={[
              { id: "approved", label: `المعتمدة (${approved})` },
              { id: "all", label: `الكل (${templates.length})` },
            ]}
            activeTab={filter}
            onTabChange={setFilter}
          />
          <TextInput
            type="search"
            aria-label="بحث في القوالب"
            placeholder="بحث بالاسم أو النص"
            prefix={<Search size={14} aria-hidden="true" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {visible.length ? (
          <ul className="settings-templates">
            {visible.map((template) => (
              <TemplateItem key={template.id} template={template} />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={FileText}
            title={
              templates.length ? "لا توجد قوالب مطابقة" : "لا توجد قوالب بعد"
            }
            description={
              templates.length
                ? "غيّر التصفية أو كلمة البحث."
                : "أنشئ قالبًا من WhatsApp Manager في Meta، ثم اضغط «تحديث من Meta»."
            }
          />
        )}
        <p className="form-hint">
          {query.data.syncedAt
            ? `آخر تحديث ${timeAgo(Date.parse(query.data.syncedAt))}. `
            : ""}
          قريبًا: تختار من هذه القوالب داخل كل ميزة بدل كتابة اسمها.
        </p>
      </>
    );
  }

  return (
    <Card>
      <Card.Header
        icon={FileText}
        title="قوالب واتساب"
        subtitle="قوالبك كما هي في Meta: الحالة والفئة والنص والمتغيرات."
        actions={
          connected && (
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => sync.mutate()}
              loading={sync.isPending}
            >
              تحديث من Meta
            </Button>
          )
        }
      />
      <div className="settings-body">{content}</div>
    </Card>
  );
}
