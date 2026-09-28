/**
 * SDK event handlers for the Test Console.
 *
 * Each handler maps an `embedded::*` event name to the matching SDK method.
 * Handlers receive `(payload, ctx)` where ctx is
 * `{ embedded, bootstrap, logMessage, showToast, navSync, eventName }`.
 * Errors thrown here are caught and reported by the dispatcher.
 */

async function introspect(_payload, { embedded, logMessage, showToast }) {
  showToast("Calling auth.introspect()...", "info");
  try {
    const result = await embedded.auth.introspect();
    if (result.isVerified && result.data) {
      showToast(
        `Introspect verified. Merchant ID: ${result.data.merchant_id}, User ID: ${result.data.user_id}`,
        "success",
      );
    } else {
      showToast(
        `Introspect failed: ${String(result.error || "Unknown error")}`,
        "error",
      );
    }
    logMessage("incoming", {
      event: "embedded::auth.introspect.response",
      isVerified: result.isVerified,
      isError: result.isError,
      data: result.data,
      error: result.error,
    });
  } catch (error) {
    showToast(`Introspect error: ${error.message}`, "error");
    logMessage("incoming", {
      event: "embedded::auth.introspect.response",
      success: false,
      error: error.message,
    });
  }
}

async function addNavItem(payload, ctx) {
  const { navSync, logMessage, showToast, eventName } = ctx;
  showToast("Calling nav.addNavItem()…", "info");
  try {
    if (!navSync?.addDynamicItem) {
      throw new Error("Add item handler is missing");
    }
    const result = await navSync.addDynamicItem();
    showToast(`Added navbar item. ID: ${result.id || "none"}`, "success");
    logMessage("incoming", {
      event: "embedded::nav.addItem.response",
      item: result,
    });
  } catch (err) {
    showToast(`addNavItem failed: ${err.message}`, "error");
    logMessage("outgoing", { event: eventName, ...payload }, err.message);
  }
}

async function updateNavItem(_payload, { navSync, showToast }) {
  try {
    if (!navSync?.updateLatestDynamicItem) {
      throw new Error("Update item handler is missing");
    }
    const latest = await navSync.updateLatestDynamicItem();
    showToast(`nav.updateNavItem: ${latest.value}`, "success");
  } catch (err) {
    showToast(`updateNavItem failed: ${err.message}`, "error");
  }
}

async function removeNavItem(_payload, { navSync, showToast }) {
  try {
    if (!navSync?.removeLatestDynamicItem) {
      throw new Error("Remove item handler is missing");
    }
    const latest = await navSync.removeLatestDynamicItem();
    showToast(`nav.removeNavItem: ${latest.value}`, "success");
  } catch (err) {
    showToast(`removeNavItem failed: ${err.message}`, "warning");
  }
}

function loading(payload, { embedded }) {
  embedded.ui.toast.info(
    "Loading event sent. You should call embedded.ui.loading.hide() to re-show the App. This test App will automatically hide loading after 10 seconds",
  );
  if (payload.action === "show") {
    embedded.ui.loading.show();
    setTimeout(() => {
      embedded.ui.loading.hide();
    }, 10000);
  } else {
    embedded.ui.loading.hide();
  }
}

async function confirmDialog(payload, { embedded, logMessage, showToast }) {
  showToast("Waiting for confirm dialog response...", "info");
  try {
    const result = await embedded.ui.confirm({
      title: payload.title,
      message: payload.message,
      confirmText: payload.confirmText,
      cancelText: payload.cancelText,
      variant: payload.variant,
    });
    showToast(
      `Confirm result: ${result.confirmed ? "✓ Confirmed" : "✗ Cancelled"}`,
      result.confirmed ? "success" : "info",
    );
    logMessage("incoming", {
      event: "embedded::ui.confirm.response",
      confirmed: result.confirmed,
    });
  } catch (error) {
    showToast(`Confirm error: ${error.message}`, "error");
  }
}

export const SDK_EVENT_HANDLERS = {
  "embedded::iframe.ready": (_p, { bootstrap }) => bootstrap(),

  "embedded::ready": (_p, { embedded, showToast }) => {
    embedded.ready();
    showToast("Ready signal sent!", "success");
  },

  "embedded::auth.refresh": (_p, { embedded }) => embedded.auth.refresh(),
  "embedded::auth.introspect": introspect,
  "embedded::destroy": (_p, { embedded }) => embedded.destroy(),

  "embedded::page.navigate": (p, { embedded }) =>
    embedded.page.navigate(p.path, { state: p.state, replace: p.replace }),
  "embedded::page.redirect": (p, { embedded }) => embedded.page.redirect(p.url),
  "embedded::page.setTitle": (p, { embedded }) =>
    embedded.page.setTitle(p.title),

  "embedded::nav.setAction": (p, { embedded }) =>
    embedded.nav.setAction({
      title: p.title,
      value: p.value,
      subTitle: p.subTitle,
      icon: p.icon,
      disabled: p.disabled,
      extendedActions: p.extendedActions,
    }),
  "embedded::nav.clearAction": (_p, { embedded }) => embedded.nav.clearAction(),
  "embedded::nav.addItem": addNavItem,
  "embedded::nav.updateItem": updateNavItem,
  "embedded::nav.removeItem": removeNavItem,

  "embedded::ui.loading": loading,
  "embedded::ui.breadcrumbs": (p, { embedded }) =>
    p.action === "hide"
      ? embedded.ui.breadcrumbs.hide()
      : embedded.ui.breadcrumbs.show(),
  "embedded::ui.toast": (p, { embedded }) =>
    embedded.ui.toast.show({
      type: p.type,
      message: p.message,
      duration: p.duration,
    }),
  "embedded::ui.confirm": confirmDialog,
};
