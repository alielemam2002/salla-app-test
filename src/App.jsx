import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./utils/queryClient.js";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import { APP_TABS } from "./config/tabs.js";
import { usePlaygroundApp } from "./hooks/app/usePlaygroundApp.js";
import AppLayout from "./components/layout/AppLayout.jsx";
import AddonsTab from "./components/Addons/AddonsTab.jsx";
import ProductsTab from "./components/Products/ProductsTab.jsx";
import CouponsTab from "./components/Coupons/CouponsTab.jsx";
import CartRecoveryTab from "./components/CartRecovery/CartRecoveryTab.jsx";
import CampaignsTab from "./components/Campaigns/CampaignsTab.jsx";
import AlertsTab from "./components/Alerts/AlertsTab.jsx";
import ReplenishTab from "./components/Replenish/ReplenishTab.jsx";
import MobileAppTab from "./components/MobileApp/MobileAppTab.jsx";
import SettingsTab from "./components/Settings/SettingsTab.jsx";

function AppContent() {
  const { sdk, connection, messageLog, activeTab, setActiveTab, showToast } =
    usePlaygroundApp();
  const { embedded } = sdk;
  const { logMessage } = messageLog;

  return (
    <AppLayout
      connection={connection}
      tabs={APP_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === "products" && (
        <ProductsTab embedded={embedded} showToast={showToast} />
      )}
      {activeTab === "alerts" && (
        <AlertsTab embedded={embedded} showToast={showToast} />
      )}
      {activeTab === "coupons" && (
        <CouponsTab embedded={embedded} showToast={showToast} />
      )}
      {activeTab === "cart-recovery" && (
        <CartRecoveryTab
          embedded={embedded}
          showToast={showToast}
          onNavigate={setActiveTab}
        />
      )}
      {activeTab === "campaigns" && (
        <CampaignsTab
          embedded={embedded}
          showToast={showToast}
          onNavigate={setActiveTab}
        />
      )}
      {activeTab === "replenish" && (
        <ReplenishTab
          embedded={embedded}
          showToast={showToast}
          onNavigate={setActiveTab}
        />
      )}
      {activeTab === "mobile-app" && (
        <MobileAppTab embedded={embedded} showToast={showToast} />
      )}
      {activeTab === "settings" && (
        <SettingsTab embedded={embedded} showToast={showToast} />
      )}
      {activeTab === "addons" && (
        <AddonsTab
          embedded={embedded}
          logMessage={logMessage}
          showToast={showToast}
        />
      )}
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
