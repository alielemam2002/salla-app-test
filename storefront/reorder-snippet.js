/* global salla */
/**
 * Smart Reorder: test snippet (Salla App Snippet, runs on the storefront).
 * Paste into Partners Portal → the app → App Snippets. Not served by Vercel.
 *
 * Link: https://<store>/?reorder=<order id>[&coupon=CODE][&reorder_debug=1]
 *
 * 1. Guest: opens Salla's login modal. Salla reloads the page after login
 *    (same link), so this runs again as the logged-in customer.
 * 2. Logged in: salla.order.createCartFromOrder({ id }). Salla rebuilds the
 *    order's items in a new cart and sends the customer to checkout; Salla
 *    decides whether the order belongs to this customer.
 * 3. coupon: tried with salla.cart.addCoupon once the cart exists. Whether
 *    that lands before Salla's redirect is one of the things this tests.
 * 4. If Salla didn't redirect, open the cart page after a short wait.
 *
 * reorder_debug=1 logs every step and Salla's answers to the console.
 * Salla's snippet validator scans the whole text, comments included: don't
 * even mention its banned APIs here (see reorderSnippet.test.js).
 */
(function () {
  var params = new URLSearchParams(window.location.search);
  var orderId = params.get("reorder");
  if (!orderId) return;

  var debug = params.get("reorder_debug") === "1";
  function log() {
    if (!debug) return;
    var args = Array.prototype.slice.call(arguments);
    console.info.apply(console, ["[reorder]"].concat(args));
  }

  if (!/^\d{1,20}$/.test(orderId)) {
    log("ignored: order id must be digits", orderId);
    return;
  }
  var coupon = params.get("coupon") || "";
  if (coupon && !/^[\w-]{1,40}$/.test(coupon)) {
    log("ignored coupon (letters, digits, _ and - only)", coupon);
    coupon = "";
  }

  // Once per order per tab, so going back from checkout doesn't rebuild
  // the cart again.
  var doneKey = "salla_reorder_done_" + orderId;
  function session(action, value) {
    try {
      if (action === "get") return window.sessionStorage.getItem(doneKey);
      if (action === "set") window.sessionStorage.setItem(doneKey, value);
      if (action === "remove") window.sessionStorage.removeItem(doneKey);
    } catch (e) {
      // Storage blocked: the guard just doesn't apply.
    }
    return null;
  }

  function notify(type, message) {
    try {
      salla.notify[type](message);
    } catch (e) {
      log("notify failed", e);
    }
  }

  salla.onReady(function () {
    if (session("get")) {
      log("already reordered in this tab", orderId);
      return;
    }

    var userId = salla.config.get("user.id");
    var guest = !userId || salla.config.get("user.type") === "guest";
    log("order", orderId, "user", userId, "guest", guest, "coupon", coupon);

    if (guest) {
      notify("info", "سجّل دخولك لإعادة طلبك السابق بضغطة واحدة.");
      salla.event.emit("login::open");
      return;
    }

    session("set", new Date().toISOString());
    notify("info", "جارٍ تجهيز سلتك من طلبك السابق…");

    salla.order
      .createCartFromOrder({ id: Number(orderId) })
      .then(function (response) {
        log("createCartFromOrder ok", response);
        if (!coupon) return null;
        return salla.cart
          .addCoupon(coupon)
          .then(function (result) {
            log("addCoupon ok", result);
          })
          .catch(function (error) {
            log("addCoupon failed", error);
          });
      })
      .then(function () {
        // Salla normally redirects to checkout by itself; if the page is
        // still here, show the cart.
        setTimeout(function () {
          log("no redirect by Salla, opening the cart");
          window.location.href = salla.url.get("cart");
        }, 2500);
      })
      .catch(function (error) {
        session("remove");
        log("createCartFromOrder failed", error);
        notify(
          "error",
          "تعذّر إعادة الطلب. تأكد أنك مسجّل بنفس الحساب الذي طلب، أو أن المنتجات ما زالت متوفرة.",
        );
      });
  });
})();
