import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeWhatsAppSignup,
  fetchSignupConfig,
} from "../../utils/whatsappApi.js";
import {
  loadFacebookSdk,
  loginOptions,
  parseSignupMessage,
} from "../../utils/whatsapp/embeddedSignup.js";
import { SettingsApiError, settingsKeys } from "../settings/useSettings.js";
import { whatsappKeys } from "../cartRecovery/useCartRecovery.js";

export const signupKeys = { config: ["whatsapp-signup-config"] };

// The ids usually arrive before FB.login's callback; give them a moment
// after the code (which Meta keeps valid for about 30 seconds).
export const IDS_WAIT_MS = 5000;

const IDLE = { phase: "idle" };

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

/** The popup closed without a code: why, from its last message. */
function closedState(outcome) {
  if (outcome?.kind === "no_phone") {
    return {
      phase: "error",
      error:
        "أُنشئ حساب واتساب للأعمال بدون رقم. أعد الربط واختر رقمًا أو أضف رقمًا جديدًا.",
    };
  }
  if (outcome?.kind === "error") {
    return {
      phase: "error",
      error: outcome.message
        ? `رفضت Meta إكمال الربط: ${outcome.message}`
        : "رفضت Meta إكمال الربط. أعد المحاولة.",
    };
  }
  return { phase: "cancelled", step: outcome?.step || null };
}

/**
 * "Connect WhatsApp with Facebook" (Meta Embedded Signup). The SDK is
 * loaded as soon as the server says it's set up, so FB.login runs right in
 * the click (anything async first gets the popup blocked).
 *
 * phase: idle | open (popup) | saving | done | cancelled | error
 */
export function useEmbeddedSignup(getToken) {
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: signupKeys.config,
    queryFn: withToken(getToken, fetchSignupConfig),
    retry: false,
    staleTime: Infinity,
  });
  const available = Boolean(config.data?.available);
  const [sdkReady, setSdkReady] = useState(false);
  const [state, setState] = useState(IDLE);
  const session = useRef(null);

  const { mutate } = useMutation({
    mutationFn: withToken(getToken, completeWhatsAppSignup),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: whatsappKeys.status });
      queryClient.invalidateQueries({ queryKey: whatsappKeys.settings });
      if (result.templates) {
        queryClient.setQueryData(settingsKeys.templates, {
          success: true,
          ...result.templates,
        });
      }
    },
  });

  useEffect(() => {
    if (!available) return undefined;
    let alive = true;
    loadFacebookSdk(config.data).then(
      () => alive && setSdkReady(true),
      () =>
        alive &&
        setState({
          phase: "error",
          error:
            "تعذّر تحميل أداة فيسبوك. تحقق من الاتصال أو من مانع الإعلانات ثم أعد تحميل الصفحة.",
        }),
    );
    return () => {
      alive = false;
    };
  }, [available, config.data]);

  // Both the code and the ids are here: send them once.
  const finish = useCallback(() => {
    const current = session.current;
    if (!current || current.sent || !current.code || !current.ids) return;
    current.sent = true;
    clearTimeout(current.timer);
    setState({ phase: "saving" });
    mutate(
      { code: current.code, ...current.ids },
      {
        onSuccess: (result) =>
          setState({
            phase: "done",
            warnings: result.warnings || [],
            templatesError: result.templatesError || null,
          }),
        onError: (error) => setState({ phase: "error", error: error.message }),
      },
    );
  }, [mutate]);

  // Meta's popup posts the ids (finish) or why it stopped.
  useEffect(() => {
    const onMessage = (event) => {
      const message = parseSignupMessage(event);
      const current = session.current;
      if (!message || !current || current.sent) return;
      if (message.kind === "finish") {
        current.ids = {
          wabaId: message.wabaId,
          phoneNumberId: message.phoneNumberId,
        };
        finish();
      } else {
        current.outcome = message;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [finish]);

  useEffect(() => () => clearTimeout(session.current?.timer), []);

  const start = useCallback(() => {
    const FB = window.FB;
    if (!FB || !available) return;
    clearTimeout(session.current?.timer);
    const current = { code: null, ids: null, outcome: null, sent: false };
    session.current = current;
    setState({ phase: "open" });
    FB.login((response) => {
      if (session.current !== current || current.sent) return;
      const code = response?.authResponse?.code;
      if (!code) {
        current.sent = true;
        setState(closedState(current.outcome));
        return;
      }
      current.code = code;
      if (current.ids) {
        finish();
        return;
      }
      current.timer = setTimeout(() => {
        if (current.sent) return;
        current.sent = true;
        setState(
          current.outcome
            ? closedState(current.outcome)
            : {
                phase: "error",
                error:
                  "لم تصل بيانات حساب واتساب من نافذة فيسبوك. أعد المحاولة وأكمل الخطوات حتى النهاية.",
              },
        );
      }, IDS_WAIT_MS);
    }, loginOptions(config.data.configId));
  }, [available, config.data, finish]);

  const reset = useCallback(() => setState(IDLE), []);

  return {
    available,
    ready: available && sdkReady,
    busy: state.phase === "open" || state.phase === "saving",
    ...state,
    start,
    reset,
  };
}
