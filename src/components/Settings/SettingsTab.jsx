import { useCallback } from "react";
import {
  useWhatsAppSettings,
  useWhatsAppSettingsMutations,
} from "../../hooks/cartRecovery/useCartRecovery.js";
import {
  useSettingsMutations,
  useStoreInfo,
  useWhatsAppTemplates,
} from "../../hooks/settings/useSettings.js";
import StoreInfoCard from "./StoreInfoCard.jsx";
import WhatsAppAccountCard from "./WhatsAppAccountCard.jsx";
import WhatsAppTemplatesCard from "./WhatsAppTemplatesCard.jsx";

/**
 * The merchant's settings, in one place: the store's details from Salla,
 * the WhatsApp Business account (entered once for every feature) and the
 * account's templates read from Meta. Picking a template inside each
 * feature comes next (stage 2).
 */
export default function SettingsTab({ embedded, showToast }) {
  const getToken = useCallback(
    () => embedded?.auth?.getToken?.() || null,
    [embedded],
  );
  const store = useStoreInfo(getToken);
  const whatsapp = useWhatsAppSettings(getToken);
  const templates = useWhatsAppTemplates(getToken);
  const { toggle, remove } = useWhatsAppSettingsMutations(getToken);
  const { saveAccount, syncTemplates } = useSettingsMutations(getToken);

  return (
    <div className="settings-page">
      <StoreInfoCard query={store} />
      <WhatsAppAccountCard
        query={whatsapp}
        saveAccount={saveAccount}
        toggle={toggle}
        remove={remove}
        // Disconnecting also deletes the saved templates.
        onRemoved={() => templates.refetch()}
        showToast={showToast}
      />
      <WhatsAppTemplatesCard
        query={templates}
        sync={syncTemplates}
        account={whatsapp.data?.settings}
      />
    </div>
  );
}
