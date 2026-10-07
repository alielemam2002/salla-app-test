import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  Send,
  Sparkles,
  Smartphone,
  Users,
} from "lucide-react";
import { Button, Card, Spinner, TextInput } from "../ui/index.js";
import {
  fetchPushHistory,
  sendPushNotification as sendPushNotificationApi,
} from "../../utils/mobileAppApi.js";
import { getToken } from "../../utils/sallaSession.js";

const PRESET_MESSAGES = [
  {
    title: "🔥 عرض حصري لمستخدمي التطبيق!",
    body: "استمتع بخصم 20% على طلبك القادم باستخدام كود APP20.",
    url: "/offers",
  },
  {
    title: "✨ منتجات جديدة وصلت الآن!",
    body: "تصفح أحدث التشكيلات والمنتجات المضافة اليوم قبل نفاد الكمية.",
    url: "/categories",
  },
  {
    title: "⚡ خصومات نهاية الأسبوع بدأت!",
    body: "عروض قوية على جميع الأقسام مع توصيل مجاني للطلبات فوق 200 ر.س.",
    url: "/cart",
  },
];

export default function MobilePushNotificationManager({
  getToken: customGetToken,
  onPreviewNotification,
  showToast,
}) {
  const queryClient = useQueryClient();
  const resolveToken = () => (customGetToken ? customGetToken() : getToken());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["mobile-app-push-history"],
    queryFn: async () => {
      const token = resolveToken();
      return await fetchPushHistory(token);
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("يرجى إدخال عنوان الإشعار");
      if (!body.trim()) throw new Error("يرجى إدخال نص الإشعار");

      const token = resolveToken();
      const res = await sendPushNotificationApi(token, {
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || null,
      });

      if (!res.success) throw new Error(res.error || "تعذّر إرسال الإشعار");
      return res;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["mobile-app-push-history"] });
      showToast?.("تم إرسال الإشعار الفوري بنجاح لجميع الأجهزة! 🚀", "success");
      // Trigger notification banner in mockup as well
      onPreviewNotification?.({ title, body });
      setTitle("");
      setBody("");
      setUrl("");
    },
    onError: (err) => {
      showToast?.(err.message, "error");
    },
  });

  const handleApplyPreset = (preset) => {
    setTitle(preset.title);
    setBody(preset.body);
    setUrl(preset.url);
    onPreviewNotification?.({ title: preset.title, body: preset.body });
  };

  const handleLivePreview = () => {
    if (!title && !body) {
      showToast?.("أدخل عنوان أو نص الإشعار لمعاينته على الهاتف", "info");
      return;
    }
    onPreviewNotification?.({
      title: title || "عنوان الإشعار التجريبي",
      body: body || "هذا هو شكل الإشعار كما سيظهر على شاشة هاتف عميلك فور إرساله.",
    });
  };

  const subscribersCount = data?.subscribersCount ?? 0;
  const history = data?.history || [];

  return (
    <div className="push-manager-container">
      {/* Top Header & Stat Strip */}
      <div className="push-manager-header">
        <div className="push-header-title-row">
          <div className="push-header-icon-box">
            <Bell size={22} />
          </div>
          <div>
            <h3>مركز الإشعارات الفورية (Push Notifications)</h3>
            <p>
              تواصل مباشرة مع عملائك عبر إرسال إشعارات فورية تظهر على شاشة هواتفهم لزيادة المبيعات وعودة العملاء.
            </p>
          </div>
        </div>

        <div className="push-stats-strip">
          <div className="push-stat-box">
            <Users size={16} className="push-stat-icon" />
            <div>
              <span className="stat-value">{subscribersCount}</span>
              <span className="stat-label">الأجهزة النشطة</span>
            </div>
          </div>
          <div className="push-stat-box">
            <Send size={16} className="push-stat-icon" />
            <div>
              <span className="stat-value">{history.length}</span>
              <span className="stat-label">الإشعارات المرسلة</span>
            </div>
          </div>
          <div className="push-stat-box">
            <CheckCircle2 size={16} className="push-stat-icon text-success" />
            <div>
              <span className="stat-value">100%</span>
              <span className="stat-label">نسبة التسليم</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Broadcast Card */}
      <Card className="push-broadcast-card">
        <div className="broadcast-card-header">
          <h4>إنشاء إشعار فوري جديد</h4>
          <span className="broadcast-badge">
            <Sparkles size={12} /> مجاني وبدون تكلفة رسائل SMS
          </span>
        </div>

        {/* Quick Presets */}
        <div className="push-presets-section">
          <span className="presets-label">قوالب سريعة مقترحة:</span>
          <div className="push-presets-list">
            {PRESET_MESSAGES.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                className="push-preset-chip"
                onClick={() => handleApplyPreset(preset)}
              >
                {preset.title}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="push-form-fields">
          <div className="form-group">
            <label className="form-label" htmlFor="push-title-input">
              عنوان الإشعار <span className="form-required">*</span>
            </label>
            <TextInput
              id="push-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: 🔥 خصم 20% لفترة محدودة!"
              maxLength={60}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="push-body-input">
              نص الإشعار <span className="form-required">*</span>
            </label>
            <TextInput
              id="push-body-input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="مثال: تسوق الآن واستمتع بخصم خاص وتوصيل مجاني لجميع الطلبات."
              maxLength={150}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="push-url-input">
              رابط التوجيه عند النقر (Deep Link) <small className="text-muted">(اختياري)</small>
            </label>
            <TextInput
              id="push-url-input"
              dir="ltr"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/offers أو /categories أو رابط صفحة المنتج"
            />
            <span className="form-hint">
              عند نقر العميل على الإشعار، سيفتح التطبيق ويوجهه مباشرة إلى هذه الصفحة.
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="push-form-actions">
          <Button
            type="button"
            variant="secondary"
            icon={Eye}
            onClick={handleLivePreview}
          >
            معاينة في الهاتف 📱
          </Button>

          <Button
            type="button"
            variant="primary"
            icon={Send}
            onClick={() => sendMutation.mutate()}
            loading={sendMutation.isPending}
            disabled={!title.trim() || !body.trim()}
          >
            إرسال الإشعار لجميع العملاء 🚀
          </Button>
        </div>
      </Card>

      {/* Broadcast History Table */}
      <Card className="push-history-card">
        <div className="history-card-header">
          <Clock size={16} />
          <h4>سجل الإشعارات المرسلة مؤخراً</h4>
        </div>

        {isLoading ? (
          <div style={{ padding: "24px", textAlign: "center" }}>
            <Spinner size={24} label="جاري تحميل سجل الإشعارات..." />
          </div>
        ) : history.length === 0 ? (
          <div className="push-history-empty">
            <Smartphone size={32} className="empty-icon" />
            <p>لم يتم إرسال أي إشعارات بعد. أنشئ أول إشعار ترويجي لعملائك بالأعلى!</p>
          </div>
        ) : (
          <div className="push-history-list">
            {history.map((item) => (
              <div key={item.id} className="push-history-item">
                <div className="history-item-main">
                  <div className="history-title-row">
                    <strong>{item.title}</strong>
                    <span className="history-status-badge">
                      <CheckCircle2 size={12} /> {item.status === "DELIVERED" ? "تم التسليم" : "مجدول"}
                    </span>
                  </div>
                  <p className="history-body">{item.body}</p>
                  {item.url && (
                    <span className="history-url" dir="ltr">
                      🔗 {item.url}
                    </span>
                  )}
                </div>
                <div className="history-item-meta">
                  <span className="history-recipients">
                    {item.recipientsCount} مستلم
                  </span>
                  <span className="history-time">
                    {new Date(item.sentAt).toLocaleDateString("ar-SA", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
