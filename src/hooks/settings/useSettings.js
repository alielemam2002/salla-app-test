import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStoreInfo } from "../../utils/storeApi.js";
import {
  fetchWhatsAppTemplates,
  saveWhatsAppAccount,
  syncWhatsAppTemplates,
} from "../../utils/whatsappApi.js";
import { whatsappKeys } from "../cartRecovery/useCartRecovery.js";

/** Error carrying the API result so the UI can describe it. */
export class SettingsApiError extends Error {
  constructor(result) {
    super(result?.error || "تعذّر تنفيذ العملية");
    this.name = "SettingsApiError";
    this.result = result;
  }
}

export const settingsKeys = {
  store: ["settings", "store"],
  templates: ["settings", "whatsapp-templates"],
};

const noToken = {
  success: false,
  status: 401,
  code: "session_invalid",
  error: "لم يتم العثور على رمز الجلسة. افتح التطبيق من لوحة تحكم سلة.",
};

const withToken = (getToken, fn) => async (vars) => {
  const token = getToken();
  if (!token) throw new SettingsApiError(noToken);
  const result = await fn(token, vars);
  if (!result.success) throw new SettingsApiError(result);
  return result;
};

/** Store details, the Salla account and the app's access to the store. */
export function useStoreInfo(getToken) {
  return useQuery({
    queryKey: settingsKeys.store,
    queryFn: withToken(getToken, fetchStoreInfo),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

/** The merchant's WhatsApp templates as last read from Meta. */
export function useWhatsAppTemplates(getToken) {
  return useQuery({
    queryKey: settingsKeys.templates,
    queryFn: withToken(getToken, fetchWhatsAppTemplates),
    retry: false,
  });
}

/** Save the WhatsApp account; read the templates again from Meta. */
export function useSettingsMutations(getToken) {
  const queryClient = useQueryClient();
  const setTemplates = (snapshot) =>
    queryClient.setQueryData(settingsKeys.templates, {
      success: true,
      ...snapshot,
    });

  const saveAccount = useMutation({
    mutationFn: withToken(getToken, saveWhatsAppAccount),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: whatsappKeys.status });
      queryClient.invalidateQueries({ queryKey: whatsappKeys.settings });
      if (result.templates) setTemplates(result.templates);
    },
  });
  const syncTemplates = useMutation({
    mutationFn: withToken(getToken, syncWhatsAppTemplates),
    onSuccess: setTemplates,
  });
  return { saveAccount, syncTemplates };
}
