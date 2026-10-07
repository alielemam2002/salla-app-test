# Salla Store Mobile App Template

This is the official, reusable React Native / Expo shell template used by the Salla Mobile App Generator to produce branded Android applications for Salla merchants.

## How it works

1. **Zero-Code Storefront Integration**: The app embeds the merchant's live Salla store via `react-native-webview`.
2. **Dynamic Configuration Injection**: During the build pipeline, the build worker injects `merchant-config.json` containing:
   - `appName`: The merchant's custom application title.
   - `storeUrl`: The merchant's verified Salla store URL (HTTPS).
   - `primaryColor`: The brand's primary theme hex color.
   - `packageName`: The generated unique Android application ID (e.g. `sa.salla.app.m_12345`).
   - `icon`: Path to the generated application icon.
   - `splash`: Path to the splash screen image and background color.
3. **Features Built-In**:
   - Hardware Android Back button support (`canGoBack` integration).
   - Pull-to-refresh.
   - Preserved session cookies and local storage.
   - Offline detection and Arabic retry screen.
   - Safe area handling and branded status bar.
   - External deep-link delegation (`whatsapp:`, `tel:`, `mailto:`, payment redirect).
