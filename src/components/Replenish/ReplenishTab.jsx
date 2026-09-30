import { useCallback, useMemo, useState } from "react";
import { Alert, Button, ConfirmDialog, Skeleton } from "../ui/index.js";
import { useClipboard } from "../../hooks/ui/useClipboard.js";
import { useCouponsQuery } from "../../hooks/coupons/useCoupons.js";
import {
  useReplenish,
  useReplenishMutations,
  useReplenishProducts,
} from "../../hooks/replenish/useReplenish.js";
import {
  COUPON_STATUS,
  getCouponStatus,
} from "../../utils/coupons/couponModel.js";
import ReplenishSettingsCard from "./ReplenishSettingsCard.jsx";
import ProductCyclesCard from "./ProductCyclesCard.jsx";
import RemindersCard from "./RemindersCard.jsx";
import ReplenishMessageModal from "./ReplenishMessageModal.jsx";

/**
 * Smart replenishment: consumption days per product, reminders scheduled
 * from new orders (api/salla-webhook.js), and a daily WhatsApp run with the
 * merchant's approved template (api/replenish.js).
 */
export default function ReplenishTab({ embedded, showToast }) {
  const getToken = useCallback(
    () => embedded?.auth?.getToken?.() || null,
    [embedded],
  );
  const query = useReplenish(getToken);
  const [keyword, setKeyword] = useState("");
  const products = useReplenishProducts(getToken, keyword);
  const couponsQuery = useCouponsQuery(getToken);
  const { saveSettings, setCycle, sendNow, cancel, sendTest } =
    useReplenishMutations(getToken);
  const { copy } = useClipboard();
  const [toCancel, setToCancel] = useState(null);
  const [selectedForMessage, setSelectedForMessage] = useState(null);

  const activeCoupons = useMemo(
    () =>
      (couponsQuery.data || []).filter(
        (c) => getCouponStatus(c) === COUPON_STATUS.ACTIVE,
      ),
    [couponsQuery.data],
  );

  const onError = (error) =>
    showToast?.(error.result?.error || "تعذّر تنفيذ العملية", "error");

  if (query.isPending) {
    return (
      <div className="replenish-page" aria-busy="true">
        <Skeleton height={160} />
        <Skeleton height={160} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <Alert
        tone="error"
        title="تعذّر تحميل تذكير إعادة الشراء"
        action={
          <Button size="small" onClick={() => query.refetch()}>
            إعادة المحاولة
          </Button>
        }
      >
        {query.error.result?.error || "حاول مرة أخرى."}
      </Alert>
    );
  }

  const { cycles = {}, reminders = [] } = query.data;

  return (
    <div className="replenish-page">
      <ReplenishSettingsCard
        data={query.data}
        save={saveSettings}
        sendTest={sendTest}
        coupons={activeCoupons}
        showToast={showToast}
        onCopy={async (text) => {
          const ok = await copy(text);
          showToast?.(
            ok ? "تم نسخ نص القالب" : "تعذّر النسخ",
            ok ? "success" : "error",
          );
        }}
      />

      <ProductCyclesCard
        cycles={cycles}
        productsQuery={products}
        keyword={keyword}
        onSearch={setKeyword}
        saving={setCycle.isPending}
        onSave={(product, days) =>
          setCycle.mutate(
            { productId: product.id, days, name: product.name },
            {
              onSuccess: () =>
                showToast?.(
                  `تم حفظ مدة ${product.name || "المنتج"}`,
                  "success",
                ),
              onError,
            },
          )
        }
        onRemove={(productId, cycle) =>
          setCycle.mutate(
            { productId, days: null, name: cycle.name },
            { onError },
          )
        }
      />

      <RemindersCard
        reminders={reminders}
        busy={sendNow.isPending ? sendNow.variables : null}
        customMessageTemplate={query.data?.settings?.customMessage}
        couponCode={query.data?.settings?.couponCode}
        onOpenMessage={setSelectedForMessage}
        onSendNow={(reminder) =>
          sendNow.mutate(reminder.id, {
            onSuccess: () =>
              showToast?.(
                `قبلت Meta التذكير الموجّه إلى ${reminder.customerName || "العميل"}`,
                "success",
              ),
            onError,
          })
        }
        onCancel={setToCancel}
      />

      <ReplenishMessageModal
        isOpen={Boolean(selectedForMessage)}
        onClose={() => setSelectedForMessage(null)}
        reminder={selectedForMessage}
        defaultTemplate={query.data?.settings?.customMessage}
        couponCode={query.data?.settings?.couponCode}
        showToast={showToast}
      />

      <ConfirmDialog
        isOpen={Boolean(toCancel)}
        onClose={() => setToCancel(null)}
        onConfirm={() => {
          const reminder = toCancel;
          setToCancel(null);
          cancel.mutate(reminder.id, { onError });
        }}
        tone="danger"
        title="إلغاء هذا التذكير؟"
        confirmText="إلغاء التذكير"
        cancelText="رجوع"
      >
        <p>
          لن يُرسل تذكير {toCancel?.productName || "المنتج"} إلى{" "}
          {toCancel?.customerName || "العميل"}.
        </p>
      </ConfirmDialog>
    </div>
  );
}
