import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { DEFAULT_TAB } from "../../config/tabs.js";
import { useAppBootstrap } from "../useAppBootstrap.js";
import { useCheckoutResultSubscription } from "../useCheckoutResultSubscription.js";
import { useIframeAutoBootstrap } from "../useIframeAutoBootstrap.js";
import { useMessageLog } from "../useMessageLog.js";
import { useNavSync } from "../useNavSync.js";
import { useHostMessageLogger } from "./useHostMessageLogger.js";

/**
 * App-level orchestration: SDK bootstrap, theme sync with the host, iframe
 * detection, host sub-nav sync and the test-console message log.
 * App.jsx only renders what this returns.
 */
export function usePlaygroundApp() {
  const { setTheme } = useTheme();
  const { showToast } = useToast();

  // Memoized so the SDK subscriptions don't churn.
  // The host owns the theme; follow it silently.
  const handleSdkThemeChange = useCallback(
    (newTheme) => setTheme(newTheme),
    [setTheme],
  );

  const handleSdkActionClick = useCallback(() => {}, []);

  // Recommended flow: init() → getToken() → verify → ready()
  const sdk = useAppBootstrap({
    debug: true,
    autoInit: false, // triggered by useIframeAutoBootstrap once embedded
    onThemeChange: handleSdkThemeChange,
    onActionClick: handleSdkActionClick,
  });
  const { embedded, isReady, layout, bootstrap } = sdk;

  // Checkout results (also delivered after 3DS redirects).
  useCheckoutResultSubscription();

  const { iframeMode, parentOrigin, setParentOrigin } =
    useIframeAutoBootstrap(bootstrap);

  const messageLog = useMessageLog();
  useHostMessageLogger({
    logMessage: messageLog.logMessage,
    setParentOrigin,
  });

  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);

  const {
    addDynamicItem,
    updateLatestDynamicItem,
    removeLatestDynamicItem,
    syncActiveTab,
  } = useNavSync({ embedded, isReady, setActiveTab, activeTab });

  useEffect(() => {
    syncActiveTab(activeTab);
  }, [activeTab, syncActiveTab]);

  // Adopt the host's initial theme once connected. Later theme changes
  // arrive through onThemeChange.
  const adoptedHostTheme = useRef(false);
  useEffect(() => {
    if (isReady && layout && !adoptedHostTheme.current) {
      adoptedHostTheme.current = true;
      if (layout.theme) setTheme(layout.theme);
    }
  }, [isReady, layout, setTheme]);

  return {
    sdk,
    connection: { isConnected: isReady, parentOrigin, iframeMode },
    messageLog,
    navSync: {
      addDynamicItem,
      updateLatestDynamicItem,
      removeLatestDynamicItem,
    },
    activeTab,
    setActiveTab,
    showToast,
  };
}
