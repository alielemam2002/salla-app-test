const fs = require("fs");
const path = require("path");

// Load dynamic merchant config if present, or fallback to sample
function loadMerchantConfig() {
  const configPath = path.resolve(__dirname, "merchant-config.json");
  const samplePath = path.resolve(__dirname, "merchant-config.sample.json");

  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (e) {
      console.warn("Failed to parse merchant-config.json, falling back to sample", e);
    }
  }

  if (fs.existsSync(samplePath)) {
    return JSON.parse(fs.readFileSync(samplePath, "utf-8"));
  }

  return {
    appName: "Salla Store App",
    storeUrl: "https://salla.sa",
    primaryColor: "#10B981",
    packageName: "sa.salla.app.default",
    version: "1.0.0",
    versionCode: 1,
  };
}

const merchant = loadMerchantConfig();

module.exports = {
  expo: {
    name: merchant.appName || "متجر سلة",
    slug: (merchant.appName || "salla-store")
      .toLowerCase()
      .replace(/[^a-z0-9]/gi, "-")
      .replace(/^-+|-+$/g, "") || "salla-app",
    version: merchant.version || "1.0.0",
    orientation: "portrait",
    icon: merchant.icon || "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: merchant.splash?.image || "./assets/splash.png",
      resizeMode: merchant.splash?.resizeMode || "contain",
      backgroundColor: merchant.splash?.backgroundColor || merchant.primaryColor || "#FFFFFF",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: merchant.packageName || "sa.salla.app.default",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: merchant.icon || "./assets/icon.png",
        backgroundColor: merchant.primaryColor || "#FFFFFF",
      },
      package: merchant.packageName || "sa.salla.app.default",
      versionCode: merchant.versionCode || 1,
      permissions: [
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
      ],
    },
    extra: {
      storeUrl: merchant.storeUrl || "https://salla.sa",
      primaryColor: merchant.primaryColor || "#10B981",
      appName: merchant.appName || "متجر سلة",
    },
  },
};
