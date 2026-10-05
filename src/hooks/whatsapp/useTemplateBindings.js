import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTemplateBindings,
  saveTemplateBinding,
} from "../../utils/whatsappApi.js";
import { SettingsApiError } from "../settings/useSettings.js";
import { whatsappKeys } from "../cartRecovery/useCartRecovery.js";

export const bindingKeys = { all: ["whatsapp-bindings"] };

const withToken = (getToken, fn) => async (vars) => {
  const token = getToken();
  if (!token) {
    throw new SettingsApiError({
      success: false,
      status: 401,
      code: "session_invalid",
      error: "لم يتم العثور على رمز الجلسة. افتح التطبيق من لوحة تحكم سلة.",
    });
  }
  const result = await fn(token, vars);
  if (!result.success) throw new SettingsApiError(result);
  return result;
};

/** Each feature's chosen template ({ cart?, replenish? }). */
export function useTemplateBindings(getToken) {
  return useQuery({
    queryKey: bindingKeys.all,
    queryFn: withToken(getToken, fetchTemplateBindings),
    retry: false,
  });
}

/** Save a feature's template: mutate({ feature, binding }). */
export function useSaveTemplateBinding(getToken) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: withToken(getToken, saveTemplateBinding),
    onSuccess: (result) => {
      queryClient.setQueryData(bindingKeys.all, {
        success: true,
        bindings: result.bindings,
      });
      // Cart Recovery shows the chosen template in its status.
      queryClient.invalidateQueries({ queryKey: whatsappKeys.status });
    },
  });
}
