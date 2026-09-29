/**
 * Salla storefront snippet: coupon announcement bar.
 *
 * Not bundled with the app. Paste this file's content into the app's
 * storefront snippet (Partners Portal → app → App Snippets, or
 * `salla_snippets action=create`, place "before", tag "body").
 *
 * It reads the bar the merchant set up in the app's Coupons tab from the
 * app's settings. These fields must exist in the app's settings form with
 * `public: true`, or salla.config.get() returns undefined:
 *   coupon_bar_enabled, coupon_bar_code, coupon_bar_text,
 *   coupon_bar_bg_color, coupon_bar_text_color, coupon_bar_ends_at
 */
(function () {
  "use strict";

  if (window.__COUPON_BAR_LOADED__) return;
  window.__COUPON_BAR_LOADED__ = true;

  var BAR_ID = "app-coupon-announcement-bar";
  var COLOR_RE = /^#[0-9a-f]{6}$/i;

  function setting(key) {
    try {
      return window.salla.config.get("app." + key);
    } catch (e) {
      return undefined;
    }
  }

  function isOn(value) {
    return value === true || value === "true" || value === 1;
  }

  function isArabic() {
    var lang = "";
    try {
      lang = window.salla.config.get("user.language_code") || "";
    } catch (e) {
      /* fall through */
    }
    lang = lang || document.documentElement.lang || "ar";
    return lang.toLowerCase().indexOf("en") !== 0;
  }

  // Remember a dismissal for this exact bar during the visit only.
  function dismissKey(code, text) {
    return "coupon-bar-dismissed:" + code + ":" + text;
  }

  function wasDismissed(key) {
    try {
      return window.sessionStorage.getItem(key) === "1";
    } catch (e) {
      return false;
    }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    var input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(input);
    }
    return Promise.resolve();
  }

  function render() {
    if (document.getElementById(BAR_ID)) return;
    if (!isOn(setting("coupon_bar_enabled"))) return;

    var code = String(setting("coupon_bar_code") || "").trim();
    var text = String(setting("coupon_bar_text") || "").trim();
    if (!code || !text) return;

    // Hide once the coupon has ended (stored with the +03:00 store offset).
    var endsAt = Date.parse(setting("coupon_bar_ends_at") || "");
    if (!isNaN(endsAt) && endsAt <= Date.now()) return;

    var key = dismissKey(code, text);
    if (wasDismissed(key)) return;

    var bg = String(setting("coupon_bar_bg_color") || "");
    var fg = String(setting("coupon_bar_text_color") || "");
    bg = COLOR_RE.test(bg) ? bg : "var(--color-primary, #004d5b)";
    fg = COLOR_RE.test(fg) ? fg : "#ffffff";
    var ar = isArabic();

    var bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", ar ? "عرض كوبون" : "Coupon offer");
    bar.dir = ar ? "rtl" : "ltr";
    bar.style.cssText =
      "position:relative;display:flex;flex-wrap:wrap;align-items:center;" +
      "justify-content:center;gap:8px 12px;box-sizing:border-box;width:100%;" +
      "padding:10px 44px;font-family:inherit;font-size:14px;font-weight:700;" +
      "line-height:1.4;text-align:center;background:" +
      bg +
      ";color:" +
      fg +
      ";";

    var message = document.createElement("span");
    message.textContent = text;
    bar.appendChild(message);

    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = code;
    copyBtn.title = ar ? "انسخ الكود" : "Copy code";
    copyBtn.setAttribute(
      "aria-label",
      (ar ? "انسخ الكود " : "Copy code ") + code,
    );
    copyBtn.style.cssText =
      "padding:3px 10px;border:1.5px dashed " +
      fg +
      ";border-radius:6px;" +
      "background:transparent;color:inherit;font:inherit;font-family:monospace;" +
      "letter-spacing:0.04em;cursor:pointer;";
    copyBtn.addEventListener("click", function () {
      copyText(code).then(function () {
        copyBtn.textContent = ar ? "تم النسخ ✓" : "Copied ✓";
        setTimeout(function () {
          copyBtn.textContent = code;
        }, 1800);
      });
    });
    bar.appendChild(copyBtn);

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", ar ? "إغلاق" : "Close");
    closeBtn.style.cssText =
      "position:absolute;top:50%;transform:translateY(-50%);" +
      (ar ? "left:12px;" : "right:12px;") +
      "width:28px;height:28px;border:0;background:transparent;color:inherit;" +
      "font-size:20px;line-height:1;cursor:pointer;opacity:0.8;";
    closeBtn.addEventListener("click", function () {
      try {
        window.sessionStorage.setItem(key, "1");
      } catch (e) {
        /* storage blocked: close for this page only */
      }
      bar.parentNode.removeChild(bar);
    });
    bar.appendChild(closeBtn);

    document.body.insertBefore(bar, document.body.firstChild);
  }

  if (window.salla && typeof window.salla.onReady === "function") {
    window.salla.onReady(render);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
