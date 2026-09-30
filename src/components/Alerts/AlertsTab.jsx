import { useCallback, useState } from "react";
import { ConfirmDialog } from "../ui/index.js";
import { useClipboard } from "../../hooks/ui/useClipboard.js";
import {
  useAlertsMutations,
  useAlertsOverview,
  useStockLevels,
} from "../../hooks/alerts/useStockAlerts.js";
import { DEFAULT_THRESHOLD } from "../../utils/alerts/stockModel.js";
import OrderAlertsCard from "./OrderAlertsCard.jsx";
import StockLevelsCard from "./StockLevelsCard.jsx";

/**
 * The merchant's alerts: products a customer's order left out of stock or
 * running low (from Salla's order.created webhook), and the stock right now.
 */
export default function AlertsTab({ embedded, showToast }) {
  const getToken = useCallback(
    () => embedded?.auth?.getToken?.() || null,
    [embedded],
  );
  const overview = useAlertsOverview(getToken);
  const stock = useStockLevels(getToken);
  const { saveThreshold, markRead, clear } = useAlertsMutations(getToken);
  const { copy } = useClipboard();
  const [confirmClear, setConfirmClear] = useState(false);

  const webhookUrl = `${window.location.origin}/api/salla-webhook`;
  const threshold = overview.data?.settings?.threshold ?? DEFAULT_THRESHOLD;
  const onError = (error) =>
    showToast?.(error.result?.error || "تعذّر تنفيذ العملية", "error");

  return (
    <div className="alerts-page">
      <OrderAlertsCard
        query={overview}
        webhookUrl={webhookUrl}
        onCopyUrl={async () => {
          const ok = await copy(webhookUrl);
          showToast?.(
            ok ? "تم نسخ الرابط" : "تعذّر نسخ الرابط",
            ok ? "success" : "error",
          );
        }}
        onMarkRead={() => markRead.mutate(undefined, { onError })}
        markingRead={markRead.isPending}
        onClear={() => setConfirmClear(true)}
      />

      <StockLevelsCard
        query={stock}
        threshold={threshold}
        canSaveThreshold={Boolean(overview.data?.setup?.storage)}
        savingThreshold={saveThreshold.isPending}
        onThresholdChange={(value) =>
          saveThreshold.mutate(value, {
            onSuccess: () => showToast?.("تم حفظ حد التنبيه", "success"),
            onError,
          })
        }
      />

      <ConfirmDialog
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          clear.mutate(undefined, { onError });
        }}
        tone="danger"
        title="مسح كل التنبيهات؟"
        confirmText="مسح"
        cancelText="إلغاء"
      >
        <p>ستُحذف تنبيهات الطلبات السابقة. المخزون نفسه لن يتغير.</p>
      </ConfirmDialog>
    </div>
  );
}
