import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Smartphone } from "lucide-react";
import { Alert, Button, Card, Spinner } from "../ui/index.js";
import MobileAppForm from "./MobileAppForm.jsx";
import MobileDeviceMockup from "./MobileDeviceMockup.jsx";
import MobileAppBuildProgress from "./MobileAppBuildProgress.jsx";
import MobileAppSuccessCard from "./MobileAppSuccessCard.jsx";
import MobilePushNotificationManager from "./MobilePushNotificationManager.jsx";
import {
  cancelMobileAppBuild,
  fetchMobileAppConfig,
  saveMobileAppConfig,
  triggerMobileAppBuild,
} from "../../utils/mobileAppApi.js";

export default function MobileAppTab({ embedded, showToast }) {
  const queryClient = useQueryClient();
  const getToken = () => embedded?.auth?.getToken?.() || null;

  const [formConfig, setFormConfig] = useState({
    appName: "متجري في سلة",
    storeUrl: "https://salla.sa",
    primaryColor: "#10B981",
    logoUrl: null,
    packageName: "sa.salla.app.store",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState("builder"); // "builder" | "notifications"
  const [notificationBanner, setNotificationBanner] = useState(null);

  // Fetch mobile app configuration and latest build
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["mobile-app-config"],
    queryFn: async () => {
      const token = getToken();
      if (!token) throw new Error("جلسة سلة غير متوفرة");
      const res = await fetchMobileAppConfig(token);
      if (!res.success) {
        throw new Error(res.error || "تعذّر جلب بيانات التطبيق");
      }
      return res;
    },
    // Poll every 3.5 seconds if a build is actively in progress
    refetchInterval: (query) => {
      const status = query.state.data?.config?.status;
      return status === "BUILDING" ? 3500 : false;
    },
    retry: 1,
  });

  // Sync form state when data loads
  useEffect(() => {
    if (data?.config) {
      setFormConfig((prev) => ({
        ...prev,
        ...data.config,
      }));
    }
  }, [data]);

  // Mutation: Save config
  const saveMutation = useMutation({
    mutationFn: async (updatedConfig) => {
      const token = getToken();
      const res = await saveMobileAppConfig(token, updatedConfig);
      if (!res.success) throw new Error(res.error || "تعذّر حفظ التعديلات");
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-app-config"] });
      showToast?.("تم حفظ بيانات وهوية التطبيق بنجاح", "success");
    },
    onError: (err) => {
      showToast?.(err.message, "error");
    },
  });

  // Mutation: Trigger Build
  const buildMutation = useMutation({
    mutationFn: async () => {
      const token = getToken();
      // Auto-save form first
      await saveMobileAppConfig(token, formConfig);
      const res = await triggerMobileAppBuild(token);
      if (!res.success) throw new Error(res.error || "تعذّر بدء بناء التطبيق");
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-app-config"] });
      setIsEditing(false);
      showToast?.("تم بدء عملية بناء التطبيق بنجاح! 🚀", "success");
    },
    onError: (err) => {
      showToast?.(err.message, "error");
    },
  });

  // Mutation: Cancel Build
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const token = getToken();
      const res = await cancelMobileAppBuild(token);
      if (!res.success) throw new Error(res.error || "تعذّر إلغاء البناء");
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mobile-app-config"] });
      showToast?.("تم إلغاء عملية البناء", "info");
    },
    onError: (err) => {
      showToast?.(err.message, "error");
    },
  });

  if (isLoading) {
    return (
      <Card className="mobile-app-container">
        <div style={{ padding: "40px", textAlign: "center" }}>
          <Spinner size={32} label="جاري تجهيز بيانات وهوية تطبيق الجوال..." />
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="mobile-app-container">
        <Alert
          tone="error"
          title="تعذّر تحميل إعدادات التطبيق"
          action={
            <Button size="small" variant="secondary" onClick={() => refetch()}>
              إعادة المحاولة
            </Button>
          }
        >
          {error?.message || "حدث خطأ أثناء الاتصال بالخادم"}
        </Alert>
      </Card>
    );
  }

  const appStatus = data?.config?.status || "DRAFT";
  const latestBuild = data?.latestBuild || null;
  const isBuilding = appStatus === "BUILDING";
  const isCompleted = appStatus === "COMPLETED" && !isEditing;

  return (
    <div className="mobile-app-container">
      {/* Top Banner Overview */}
      <div className="mobile-app-hero-bar">
        <div className="hero-bar-text">
          <h2>📱 محول متجر سلة إلى تطبيق جوال أندرويد</h2>
          <p>
            أنشئ تطبيق أندرويد رسمي يحمل هوية متجرك وعلامتك التجارية بنقرة واحدة،
            جاهز للتثبيت الفوري والنشر على Google Play دون أي تعديل لثيم متجرك.
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="mobile-app-subtabs-nav">
          <button
            type="button"
            className={`subtab-btn ${activeSubTab === "builder" ? "active" : ""}`}
            onClick={() => setActiveSubTab("builder")}
          >
            <Smartphone size={16} />
            <span>بناء وهوية التطبيق</span>
          </button>
          <button
            type="button"
            className={`subtab-btn ${activeSubTab === "notifications" ? "active" : ""}`}
            onClick={() => setActiveSubTab("notifications")}
          >
            <Bell size={16} />
            <span>مركز الإشعارات الفورية</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="mobile-app-layout-grid">
        {/* Left Column: Interactive Phone Device Mockup */}
        <aside className="mobile-app-preview-column">
          <div className="preview-sticky-box">
            <h4 className="preview-heading">المعاينة الحية للتطبيق</h4>
            <MobileDeviceMockup
              appName={formConfig.appName}
              storeUrl={formConfig.storeUrl}
              primaryColor={formConfig.primaryColor}
              logoUrl={formConfig.logoUrl}
              bottomNavEnabled={formConfig.bottomNavEnabled !== false}
              notificationBanner={notificationBanner}
              onDismissNotification={() => setNotificationBanner(null)}
            />
          </div>
        </aside>

        {/* Right Column: Workflow Steps (Form vs Building vs Success vs Notifications) */}
        <main className="mobile-app-main-column">
          {activeSubTab === "notifications" ? (
            <MobilePushNotificationManager
              onPreviewNotification={setNotificationBanner}
              showToast={showToast}
            />
          ) : isBuilding ? (
            <MobileAppBuildProgress
              appName={formConfig.appName}
              buildId={data?.config?.currentBuildId}
              onCancel={() => cancelMutation.mutate()}
              cancelling={cancelMutation.isPending}
            />
          ) : isCompleted ? (
            <MobileAppSuccessCard
              appName={formConfig.appName}
              packageName={formConfig.packageName}
              latestBuild={latestBuild}
              onRebuild={() => setIsEditing(true)}
            />
          ) : (
            <MobileAppForm
              config={formConfig}
              onChange={setFormConfig}
              onSave={() => saveMutation.mutate(formConfig)}
              onBuild={() => buildMutation.mutate()}
              saving={saveMutation.isPending}
              building={buildMutation.isPending}
            />
          )}
        </main>
      </div>
    </div>
  );
}
