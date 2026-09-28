import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { DEFAULT_TAB } from "../../config/tabs.js";
import { useAppBootstrap } from "../useAppBootstrap.js";
import { useExposeEmbeddedGlobally } from "../useExposeEmbeddedGlobally.js";
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
  const handleSdkThemeChange = useCallback(
    (newTheme) => {
      setTheme(newTheme);
      showToast(`Theme changed by host: ${newTheme}`, "info");
    },
    [setTheme, showToast],
  );

  const handleSdkActionClick = useCallback(
    (value) => {
      showToast(`Action clicked! Value: ${value}`, "info");
    },
    [showToast],
  );

  // Recommended flow: init() → getToken() → verify → ready()
  const sdk = useAppBootstrap({
    debug: true,
    autoInit: false, // triggered by useIframeAutoBootstrap once embedded
    onThemeChange: handleSdkThemeChange,
    onActionClick: handleSdkActionClick,
  });
  const { embedded, isReady, layout, bootstrap } = sdk;

  // Expose embedded globally for the Playground tab.
  useExposeEmbeddedGlobally();

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

  // Announce the first connection and adopt the host's initial theme.
  // Later theme changes arrive through onThemeChange.
  const hasShownConnectedToast = useRef(false);
  useEffect(() => {
    if (isReady && layout && !hasShownConnectedToast.current) {
      hasShownConnectedToast.current = true;
      showToast("Connected! Received layout context.", "success");
      if (layout.theme) setTheme(layout.theme);
    }
  }, [isReady, layout, showToast, setTheme]);

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
