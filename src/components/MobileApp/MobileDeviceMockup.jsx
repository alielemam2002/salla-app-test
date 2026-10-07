import { useState } from "react";
import {
  Battery,
  ChevronLeft,
  Globe,
  Home,
  LayoutGrid,
  Package,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  User,
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
  bottomNavEnabled = true,
  notificationBanner = null,
  onDismissNotification = null,
}) {
  const [viewMode, setViewMode] = useState("store"); // "store" | "splash"
  const [activeTab, setActiveTab] = useState("home"); // "home" | "categories" | "cart" | "profile"

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
          {/* Head-up Push Notification Banner */}
          {notificationBanner && (
            <div className="phone-push-notification-banner">
              <div className="push-banner-top">
                <div className="push-banner-app">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="push-app-logo" />
                  ) : (
                    <div
                      className="push-app-logo-fallback"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Package size={10} color="#fff" />
                    </div>
                  )}
                  <span className="push-app-name">{appName}</span>
                  <span className="push-time-ago">• الآن</span>
                </div>
                {onDismissNotification && (
                  <button
                    type="button"
                    className="push-banner-close"
                    onClick={onDismissNotification}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="push-banner-body">
                <strong className="push-banner-title">
                  {notificationBanner.title || "عنوان الإشعار"}
                </strong>
                <p className="push-banner-text">
                  {notificationBanner.body || "نص الإشعار الترويجي سيظهر هنا..."}
                </p>
              </div>
            </div>
          )}

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
                {activeTab === "home" && (
                  <>
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
                  </>
                )}

                {activeTab === "categories" && (
                  <div className="phone-mock-tab-content">
                    <div className="tab-page-header">
                      <h5>تصفح الأقسام</h5>
                      <span className="tab-page-badge">4 أقسام</span>
                    </div>
                    <div className="mock-categories-grid">
                      {[
                        { title: "الأزياء والموضة", count: "42 منتج", icon: "👗" },
                        { title: "العطور والتجميل", count: "28 منتج", icon: "✨" },
                        { title: "الإلكترونيات", count: "19 منتج", icon: "⚡" },
                        { title: "الهدايا والتحف", count: "15 منتج", icon: "🎁" },
                      ].map((c) => (
                        <div key={c.title} className="mock-category-card">
                          <span className="mock-cat-icon">{c.icon}</span>
                          <div>
                            <h6>{c.title}</h6>
                            <span>{c.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "cart" && (
                  <div className="phone-mock-tab-content">
                    <div className="tab-page-header">
                      <h5>سلة المشتريات</h5>
                      <span className="tab-page-badge">منتجان</span>
                    </div>
                    <div className="mock-cart-items">
                      {[
                        { name: "عطر فاخر خاص", price: "149 ر.س", qty: 1 },
                        { name: "ساعة ذكية أنيقة", price: "199 ر.س", qty: 1 },
                      ].map((item, idx) => (
                        <div key={idx} className="mock-cart-item">
                          <div className="mock-cart-thumb">
                            <Package size={16} />
                          </div>
                          <div className="mock-cart-info">
                            <h6>{item.name}</h6>
                            <span className="mock-cart-price">{item.price}</span>
                          </div>
                          <span className="mock-cart-qty">×{item.qty}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mock-cart-checkout">
                      <div className="mock-cart-total-row">
                        <span>المجموع:</span>
                        <strong>348 ر.س</strong>
                      </div>
                      <button
                        type="button"
                        className="mock-checkout-btn"
                        style={{ backgroundColor: primaryColor }}
                      >
                        إتمام الطلب
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === "profile" && (
                  <div className="phone-mock-tab-content">
                    <div className="mock-profile-header">
                      <div
                        className="mock-profile-avatar"
                        style={{ backgroundColor: `${primaryColor}22`, color: primaryColor }}
                      >
                        <User size={20} />
                      </div>
                      <div>
                        <h6>عبد الله الأحمد</h6>
                        <span>عميل المتجر</span>
                      </div>
                    </div>
                    <div className="mock-profile-menu">
                      {[
                        { label: "طلباتي السابقة", meta: "3 طلبات" },
                        { label: "عناوين التوصيل", meta: "الرياض" },
                        { label: "المحفظة والبطاقات", meta: "150 ر.س" },
                        { label: "المساعدة والدعم", meta: "واتساب" },
                      ].map((m) => (
                        <div key={m.label} className="mock-profile-row">
                          <span>{m.label}</span>
                          <small>{m.meta}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Store URL Bar Indicator */}
                <div className="phone-url-indicator" dir="ltr">
                  <Globe size={11} />
                  <span>{storeUrl.replace(/^https?:\/\//, "")}</span>
                </div>
              </div>

              {/* Native Bottom Navigation Bar */}
              {bottomNavEnabled && (
                <div className="phone-mock-bottom-nav">
                  {[
                    { id: "home", label: "الرئيسية", Icon: Home },
                    { id: "categories", label: "الأقسام", Icon: LayoutGrid },
                    { id: "cart", label: "السلة", Icon: ShoppingBag },
                    { id: "profile", label: "حسابي", Icon: User },
                  ].map(({ id, label, Icon }) => {
                    const isActive = activeTab === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`mock-bottom-tab-btn ${isActive ? "active" : ""}`}
                        onClick={() => setActiveTab(id)}
                        style={{ color: isActive ? primaryColor : "#94a3b8" }}
                      >
                        <Icon size={14} />
                        <span className="mock-tab-label">{label}</span>
                        {isActive && (
                          <span
                            className="mock-tab-indicator"
                            style={{ backgroundColor: primaryColor }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
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
