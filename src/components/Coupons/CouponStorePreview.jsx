import { useState } from "react";
import { Copy, Check, Eye, Globe } from "lucide-react";

/**
 * Live storefront preview rendering the exact banner from Image 1
 * and the top announcement bar from Image 2.
 */
export default function CouponStorePreview({
  code = "ZAWWID10",
  badgeTitle = "كوبون لك",
  headlineText = "خصم 10% على أول طلب",
  showAnnouncement = true,
  announcementText = "عروض رمضان بدأت · شحن مجاني فوق 200 ر.س · كود: ZAWWID10",
  announcementBg = "#f59e0b",
  announcementTextColor = "#1c1917",
  cardBg = "#092d27",
  cardTextColor = "#67e8f9",
  displayProductPage = true,
  displayCategoryPage = false,
  displayCartPage = true,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="coupon-store-preview-wrapper" dir="rtl">
      <div className="coupon-preview-header">
        <span className="coupon-preview-title">
          <Eye size={16} />
          معاينة حية للمتجر (Storefront Live Preview)
        </span>
        <div className="coupon-preview-placements">
          {showAnnouncement && (
            <span className="preview-badge preview-badge--announcement">📢 الشريط الإعلاني</span>
          )}
          {displayProductPage && (
            <span className="preview-badge preview-badge--page">🛍️ صفحة المنتج</span>
          )}
          {displayCategoryPage && (
            <span className="preview-badge preview-badge--page">🗂️ قائمة المنتجات</span>
          )}
          {displayCartPage && (
            <span className="preview-badge preview-badge--page">🛒 صفحة السلة</span>
          )}
        </div>
      </div>

      {/* Simulated Browser Frame */}
      <div className="coupon-browser-mockup">
        <div className="coupon-browser-topbar">
          <div className="browser-dots" aria-hidden="true">
            <span className="dot dot--red" />
            <span className="dot dot--yellow" />
            <span className="dot dot--green" />
          </div>
          <div className="browser-address">
            <Globe size={13} />
            <span>store.example.sa</span>
          </div>
        </div>

        {/* 1. Top Announcement Bar Preview (مثل الصورة 2) */}
        {showAnnouncement ? (
          <div
            className="coupon-announcement-bar-preview"
            style={{
              backgroundColor: announcementBg,
              color: announcementTextColor,
            }}
          >
            <span>{announcementText || `عروض حصرية بدأت · كود الخصم: ${code}`}</span>
          </div>
        ) : (
          <div className="coupon-announcement-bar-disabled">
            <span>الشريط الإعلاني أعلى المتجر معطّل لهذا الكوبون</span>
          </div>
        )}

        {/* Simulated Store Page Content */}
        <div className="coupon-browser-body">
          <div className="coupon-store-content-mockup">
            <div className="mock-page-title">
              {displayProductPage ? "صفحة تفاصيل المنتج (Single Product Page)" : "صفحة السلة (Cart Page)"}
            </div>

            {/* 2. In-Page Coupon Card Banner (طِبق الأصل من الصورة 1) */}
            <div
              className="coupon-store-banner-card"
              style={{
                backgroundColor: cardBg,
                borderColor: "rgba(34, 211, 238, 0.25)",
              }}
            >
              {/* Right: Badge and Headline */}
              <div className="coupon-banner-info">
                <span className="coupon-banner-badge" style={{ color: cardTextColor }}>
                  {badgeTitle || "كوبون لك"}
                </span>
                <span className="coupon-banner-headline" style={{ color: cardTextColor }}>
                  {headlineText || "خصم 10% على أول طلب"}
                </span>
              </div>

              {/* Left: Dashed code button (Click to copy) */}
              <button
                type="button"
                onClick={handleCopy}
                className="coupon-banner-code-box"
                style={{
                  color: cardTextColor,
                  borderColor: cardTextColor,
                }}
                title="اضغط لنسخ الكود"
                aria-label={`اضغط لنسخ الكود ${code}`}
              >
                {copied ? (
                  <span className="copied-feedback">
                    <Check size={14} />
                    تم النسخ ✔
                  </span>
                ) : (
                  <span className="code-text">
                    <Copy size={13} className="copy-icon" />
                    {code || "ZAWWID10"}
                  </span>
                )}
              </button>
            </div>

            {/* Subtle mock placeholders for realism */}
            <div className="mock-product-wireframe">
              <div className="mock-line mock-line--lg" />
              <div className="mock-line mock-line--md" />
              <div className="mock-button-placeholder">أضف إلى السلة</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
