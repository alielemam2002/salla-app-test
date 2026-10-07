import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import NetInfo from "@react-native-community/netinfo";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import Constants from "expo-constants";

// Keep splash visible while app initializes
SplashScreen.preventAutoHideAsync().catch(() => {});

// Read injected store configuration
const extra = Constants.expoConfig?.extra || {};
const STORE_URL = extra.storeUrl || "https://salla.sa";
const PRIMARY_COLOR = extra.primaryColor || "#10B981";
const APP_NAME = extra.appName || "متجر سلة";

export default function App() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsConnected(online);
      if (online && hasError) {
        setHasError(false);
        webViewRef.current?.reload();
      }
    });

    return () => unsubscribe();
  }, [hasError]);

  // Android hardware back button handler
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const onBackPress = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );
    return () => subscription.remove();
  }, [canGoBack]);

  // Hide native splash once loaded
  const handleLoadEnd = useCallback(async () => {
    setIsLoading(false);
    await SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Handle external links (WhatsApp, Phone, Email, External Gateways)
  const handleShouldStartLoad = (request) => {
    const { url } = request;

    // External protocol schemes
    const externalProtocols = [
      "whatsapp:",
      "tel:",
      "mailto:",
      "sms:",
      "intent:",
      "alipay:",
    ];

    const isExternalScheme = externalProtocols.some((protocol) =>
      url.startsWith(protocol)
    );

    if (isExternalScheme) {
      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported) Linking.openURL(url);
        })
        .catch(() => {});
      return false;
    }

    return true;
  };

  // Offline Screen
  if (!isConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <ExpoStatusBar style="light" backgroundColor={PRIMARY_COLOR} />
        <View style={styles.centeredContainer}>
          <Text style={styles.errorIcon}>📡</Text>
          <Text style={styles.errorTitle}>لا يوجد اتصال بالإنترنت</Text>
          <Text style={styles.errorSubtitle}>
            يرجى التحقق من اتصالك بالشبكة وإعادة المحاولة
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: PRIMARY_COLOR }]}
            onPress={() => {
              NetInfo.fetch().then((state) => {
                if (state.isConnected) {
                  setIsConnected(true);
                  setHasError(false);
                  webViewRef.current?.reload();
                }
              });
            }}
          >
            <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Load Error Screen
  if (hasError) {
    return (
      <SafeAreaView style={styles.container}>
        <ExpoStatusBar style="light" backgroundColor={PRIMARY_COLOR} />
        <View style={styles.centeredContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>تعذر تحميل المتجر</Text>
          <Text style={styles.errorSubtitle}>
            حدث خطأ أثناء الاتصال بالخادم. حاول مجدداً لاحقاً.
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: PRIMARY_COLOR }]}
            onPress={() => {
              setHasError(false);
              setIsLoading(true);
              webViewRef.current?.reload();
            }}
          >
            <Text style={styles.retryButtonText}>إعادة التحميل</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" backgroundColor={PRIMARY_COLOR} />
      
      {/* WebView displaying the merchant's Salla store */}
      <WebView
        ref={webViewRef}
        source={{ uri: STORE_URL }}
        style={styles.webView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        pullToRefreshEnabled={true}
        allowsBackForwardNavigationGestures={true}
        mixedContentMode="compatibility"
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
        }}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={handleLoadEnd}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
          SplashScreen.hideAsync().catch(() => {});
        }}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  webView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  errorSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
