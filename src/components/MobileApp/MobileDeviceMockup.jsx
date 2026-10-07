import { useState } from "react";
import {
  Battery,
  ChevronLeft,
  Globe,
  Package,
  Search,
  ShoppingCart,
  Sparkles,
  Wifi,
} from "lucide-react";

/**
 * Interactive Live Phone Mockup showing real-time mobile app preview
 */
export default function MobileDeviceMockup({
  appName = "متجر سلة",
  storeUrl = "https://salla.sa",
  primaryColor = "#10B981",
  logoUrl = null,
}) {
  const [viewMode, setViewMode] = useState("store"); // "store" | "splash"

  return (
    <div className="mobile-mockup-wrapper">
      <div className="mobile-mockup-mode-pills">
        <button
          type="button"
          className={`mockup-pill ${viewMode === "store" ? "active" : ""}`}
          onClick={() => setViewMode("store")}
        >
          داخل التطبيق
        </button>
        <button
          type="button"
          className={`mockup-pill ${viewMode === "splash" ? "active" : ""}`}
          onClick={() => setViewMode("splash")}
        >
          شاشة البداية (Splash)
        </button>
      </div>

      <div className="phone-device-frame">
        {/* Notch / Dynamic Island */}
        <div className="phone-notch">
          <div className="phone-speaker" />
          <div className="phone-camera" />
        </div>

        {/* Status Bar */}
        <div
          className="phone-status-bar"
          style={{ backgroundColor: viewMode === "splash" ? primaryColor : "#ffffff" }}
        >
          <span className="phone-time">9:41</span>
          <div className="phone-status-icons">
            <Wifi size={12} />
            <Battery size={13} />
          </div>
        </div>

        {/* Phone Screen Body */}
        <div className="phone-screen-content">
          {viewMode === "splash" ? (
            /* Splash Screen Mode */
            <div
              className="phone-splash-screen"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="splash-logo-container">
                {logoUrl ? (
                  <img src={logoUrl} alt={appName} className="splash-logo-img" />
                ) : (
                  <div className="splash-logo-fallback">
                    <Package size={36} color="#ffffff" />
                  </div>
                )}
                <h3 className="splash-app-title">{appName}</h3>
              </div>
              <div className="splash-footer-loader">
                <div className="splash-spinner" />
              </div>
            </div>
          ) : (
            /* Inside App (Storefront WebView) Mode */
            <div className="phone-webview-mock">
              {/* Branded Header */}
              <div
                className="phone-app-header"
                style={{ borderBottomColor: `${primaryColor}33` }}
              >
                <div className="header-left">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="header-logo" />
                  ) : (
                    <div
                      className="header-logo-placeholder"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Package size={14} color="#ffffff" />
                    </div>
                  )}
                  <span className="header-store-name">{appName}</span>
                </div>
                <div className="header-actions">
                  <Search size={15} className="header-action-icon" />
                  <ShoppingCart size={15} className="header-action-icon" />
                </div>
              </div>

              {/* WebView Mock Content */}
              <div className="phone-store-scroll">
                {/* Hero Banner */}
                <div
                  className="phone-hero-banner"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}CC 100%)`,
                  }}
                >
                  <span className="hero-badge">
                    <Sparkles size={11} /> تطبيق الجوال الرسمي
                  </span>
                  <h4>أهلاً بك في {appName}</h4>
                  <p>تسوق أحدث المنتجات والعروض الحصرية</p>
                </div>

                {/* Categories Row */}
                <div className="phone-categories-row">
                  {["وصل حديثاً", "الأكثر طلباً", "العروض", "المجموعات"].map(
                    (cat, i) => (
                      <div
                        key={cat}
                        className={`phone-cat-chip ${i === 0 ? "active" : ""}`}
                        style={
                          i === 0
                            ? { backgroundColor: primaryColor, color: "#fff" }
                            : {}
                        }
                      >
                        {cat}
                      </div>
                    ),
                  )}
                </div>

                {/* Products Grid */}
                <div className="phone-products-grid">
                  {[1, 2].map((item) => (
                    <div key={item} className="phone-product-card">
                      <div className="phone-product-thumb">
                        <Package size={22} className="phone-product-placeholder" />
                      </div>
                      <span className="phone-product-title">
                        منتج مميز #{item}
                      </span>
                      <div className="phone-product-price-row">
                        <span className="phone-product-price">149 ر.س</span>
                        <button
                          type="button"
                          className="phone-quick-add"
                          style={{ backgroundColor: primaryColor }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Store URL Bar Indicator */}
                <div className="phone-url-indicator" dir="ltr">
                  <Globe size={11} />
                  <span>{storeUrl.replace(/^https?:\/\//, "")}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Android Navigation Bar */}
        <div className="phone-nav-bar">
          <div className="phone-nav-back">
            <ChevronLeft size={16} />
          </div>
          <div className="phone-nav-home" />
          <div className="phone-nav-recent" />
        </div>
      </div>
    </div>
  );
}
