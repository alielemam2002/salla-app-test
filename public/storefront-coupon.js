/**
 * Salla App Storefront Script (App Snippet)
 * Automatically injects Announcement Bar & Coupon Cards into Merchant Stores
 */
(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__SALLA_COUPON_APP_INJECTED__) return;
  window.__SALLA_COUPON_APP_INJECTED__ = true;

  // Configuration endpoint
  const APP_API_URL = 'https://salla-app-test.vercel.app/api/storefront-settings';

  async function fetchSettings() {
    // If settings are already provided on window, use them
    if (window.SALLA_COUPON_SETTINGS) {
      return window.SALLA_COUPON_SETTINGS;
    }

    try {
      const storeId = window.salla?.config?.get('store.id') || '';
      const res = await fetch(`${APP_API_URL}?store_id=${encodeURIComponent(storeId)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function createCouponCardElement(settings) {
    const card = document.createElement('div');
    card.className = 'salla-app-coupon-card';
    card.style.cssText = `
      background-color: ${settings.card_bg || '#092d27'};
      color: #ffffff;
      border-radius: 12px;
      padding: 14px 18px;
      margin: 16px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      direction: rtl;
      font-family: inherit;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
      box-sizing: border-box;
      width: 100%;
    `;

    const code = settings.coupon_code || 'COUPON';
    const title = settings.card_title || 'كوبون لك';
    const subtitle = settings.card_subtitle || 'خصم 10% على أول طلب';

    card.innerHTML = `
      <div style="text-align: right; flex: 1;">
        <span style="color: #2dd4bf; font-size: 13px; font-weight: 700; display: block; margin-bottom: 4px;">
          ${escapeHtml(title)}
        </span>
        <span style="color: #ffffff; font-size: 15px; font-weight: 700; line-height: 1.4; display: block;">
          ${escapeHtml(subtitle)}
        </span>
      </div>
      <div>
        <button type="button" class="salla-app-coupon-btn" style="
          background: transparent;
          border: 1.5px dashed #2dd4bf;
          color: #2dd4bf;
          border-radius: 8px;
          padding: 8px 16px;
          font-family: monospace, inherit;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        ">
          ${escapeHtml(code)}
        </button>
      </div>
    `;

    const btn = card.querySelector('.salla-app-coupon-btn');
    if (btn) {
      btn.onclick = () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code);
        }
        btn.innerText = 'تم النسخ ✔';
        btn.style.borderColor = '#4ade80';
        btn.style.color = '#4ade80';
        setTimeout(() => {
          btn.innerText = code;
          btn.style.borderColor = '#2dd4bf';
          btn.style.color = '#2dd4bf';
        }, 2000);
      };
    }

    return card;
  }

  function renderAnnouncementBar(settings) {
    if (document.getElementById('salla-app-announcement-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'salla-app-announcement-bar';
    bar.style.cssText = `
      background-color: ${settings.announcement_bg || '#e59b2d'};
      color: ${settings.announcement_color || '#1a1a1a'};
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 700;
      text-align: center;
      direction: rtl;
      position: relative;
      z-index: 9999;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      width: 100%;
      box-sizing: border-box;
    `;
    bar.innerText = settings.announcement_text;
    document.body.prepend(bar);
  }

  function renderProductCouponCard(settings) {
    if (document.getElementById('salla-app-product-coupon-card')) return;
    const card = createCouponCardElement(settings);
    card.id = 'salla-app-product-coupon-card';

    // Target product details or add-to-cart area
    const target = document.querySelector(
      'salla-add-product-button, .product-details, form[action*="cart"], .product__summary'
    );
    if (target && target.parentNode) {
      target.parentNode.insertBefore(card, target);
    }
  }

  function renderCartCouponCard(settings) {
    if (document.getElementById('salla-app-cart-coupon-card')) return;
    const card = createCouponCardElement(settings);
    card.id = 'salla-app-cart-coupon-card';

    // Target cart summary or items container
    const target = document.querySelector(
      '.cart-summary, salla-cart-summary, .cart-collaterals, .cart-container'
    );
    if (target && target.parentNode) {
      target.parentNode.insertBefore(card, target);
    } else {
      const main = document.querySelector('main, .main-content');
      if (main) main.prepend(card);
    }
  }

  function renderCatalogCouponCard(settings) {
    if (document.getElementById('salla-app-catalog-coupon-card')) return;
    const card = createCouponCardElement(settings);
    card.id = 'salla-app-catalog-coupon-card';

    const target = document.querySelector('.products-list, salla-products-list, .products-container');
    if (target && target.parentNode) {
      target.parentNode.insertBefore(card, target);
    }
  }

  function isProductPage() {
    return (
      window.location.pathname.includes('/p/') ||
      !!document.querySelector('salla-product-view, .product-details, salla-add-product-button')
    );
  }

  function isCartPage() {
    return (
      window.location.pathname.includes('/cart') ||
      !!document.querySelector('salla-cart-items, .cart-summary, salla-cart-summary')
    );
  }

  function isCatalogPage() {
    return (
      (window.location.pathname.includes('/products') ||
        window.location.pathname.includes('/categories')) &&
      !isProductPage()
    );
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function init() {
    const settings = await fetchSettings();
    if (!settings || settings.active === false) return;

    if (settings.show_announcement_bar && settings.announcement_text) {
      renderAnnouncementBar(settings);
    }

    if (settings.display_product_page && isProductPage()) {
      renderProductCouponCard(settings);
    }

    if (settings.display_cart_page && isCartPage()) {
      renderCartCouponCard(settings);
    }

    if (settings.display_products_catalog && isCatalogPage()) {
      renderCatalogCouponCard(settings);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
