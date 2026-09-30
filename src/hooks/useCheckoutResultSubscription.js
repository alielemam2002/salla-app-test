import { useEffect } from "react";
import { embedded } from "@salla.sa/embedded-sdk";
import { useToast } from "../contexts/ToastContext.jsx";

/**
 * useCheckoutResultSubscription
 *
 * Subscribes to checkout results and shows toast notifications.
 * Works after 3DS redirects when user lands back on the app.
 */
export function useCheckoutResultSubscription() {
  const { showToast } = useToast();

  useEffect(() => {
    if (!embedded?.checkout?.onResult) return;

    const unsubscribe = embedded.checkout.onResult((result) => {
      if (result.success) {
        const isPending = result.status === "pending";
        const orderId = result.order_id || "غير متوفر";
        showToast(
          isPending
            ? `قيد الانتظار: الدفع لم يكتمل بعد. رقم الطلب: ${orderId}`
            : `تم الدفع بنجاح. رقم الطلب: ${orderId}`,
          isPending ? "warning" : "success",
        );
      } else if (result.status === "cancelled") {
        showToast("أُلغي إتمام الشراء", "info");
      } else {
        const errorMsg =
          result.error?.message || result.status || "خطأ غير معروف";
        showToast(`فشل إتمام الشراء: ${errorMsg}`, "error");
      }
    });

    return unsubscribe;
  }, [showToast]);
}
