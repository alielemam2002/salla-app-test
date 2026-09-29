import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./utils/queryClient.js";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import { APP_TABS } from "./config/tabs.js";
import { usePlaygroundApp } from "./hooks/app/usePlaygroundApp.js";
import AppLayout from "./components/layout/AppLayout.jsx";
import TestConsoleTab from "./components/TestConsole/TestConsoleTab.jsx";
import PlaygroundTab from "./components/Playground/PlaygroundTab.jsx";
import AddonsTab from "./components/Addons/AddonsTab.jsx";
import ProductsTab from "./components/Products/ProductsTab.jsx";
import CouponsTab from "./components/Coupons/CouponsTab.jsx";
import CartRecoveryTab from "./components/CartRecovery/CartRecoveryTab.jsx";

function AppContent() {
  const {
    sdk,
    connection,
    messageLog,
    navSync,
    activeTab,
    setActiveTab,
    showToast,
  } = usePlaygroundApp();
  const { embedded, layout, token, verifiedData, verifyStatus, bootstrap } =
    sdk;
  const { logMessage } = messageLog;

  return (
    <AppLayout
      connection={connection}
      tabs={APP_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === "test-console" && (
        <TestConsoleTab
          embedded={embedded}
          bootstrap={bootstrap}
          layout={layout}
          token={token}
          verifiedData={verifiedData}
          verifyStatus={verifyStatus}
          messageLog={messageLog}
          navSync={navSync}
        />
      )}
      {activeTab === "playground" && (
        <PlaygroundTab
          embedded={embedded}
          logMessage={logMessage}
          showToast={showToast}
        />
      )}
      {activeTab === "addons" && (
        <AddonsTab
          embedded={embedded}
          logMessage={logMessage}
          showToast={showToast}
        />
      )}
      {activeTab === "products" && (
        <ProductsTab embedded={embedded} showToast={showToast} />
      )}
      {activeTab === "coupons" && (
        <CouponsTab embedded={embedded} showToast={showToast} />
      )}
      {activeTab === "cart-recovery" && (
        <CartRecoveryTab embedded={embedded} showToast={showToast} />
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
