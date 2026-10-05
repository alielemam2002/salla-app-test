import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAllCustomers,
  fetchCustomerGroups,
} from "../../utils/customersApi.js";
import { sendCampaignMessage } from "../../utils/whatsappApi.js";
import {
  campaignLogStore,
  isFatalSendError,
  recordCampaign,
} from "../../utils/campaigns/campaignModel.js";

/** Error carrying the API result so the UI can describe it. */
export class CampaignApiError extends Error {
  constructor(result) {
    super(result?.error || "تعذّر تنفيذ الطلب");
    this.name = "CampaignApiError";
    this.result = result;
  }
}

const noToken = {
  success: false,
  status: 401,
  code: "session_invalid",
  error: "لم يتم العثور على رمز الجلسة. افتح التطبيق من لوحة تحكم سلة.",
};

/** Every store customer (with the flags a campaign needs). */
export function useCustomers(getToken) {
  return useQuery({
    queryKey: ["customers", "all"],
    queryFn: async () => {
      const token = getToken();
      if (!token) throw new CampaignApiError(noToken);
      const result = await fetchAllCustomers(token);
      if (!result.success) throw new CampaignApiError(result);
      return { customers: result.customers, truncated: result.truncated };
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

/** Customer groups for filtering (the campaign works without them). */
export function useCustomerGroups(getToken) {
  return useQuery({
    queryKey: ["customers", "groups"],
    queryFn: async () => {
      const token = getToken();
      if (!token) throw new CampaignApiError(noToken);
      const result = await fetchCustomerGroups(token);
      if (!result.success) throw new CampaignApiError(result);
      return result.groups || [];
    },
    retry: false,
    staleTime: 10 * 60 * 1000,
  });
}

/** Campaigns sent from this browser (newest first). */
export function useCampaignLog() {
  const log = useSyncExternalStore(
    campaignLogStore.subscribe,
    campaignLogStore.get,
    campaignLogStore.get,
  );
  return log.items || [];
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send a campaign to recipients one at a time (never in parallel), with a
 * short pause between messages. Stops on request, or at the first error
 * that would repeat for everyone (template not approved, token expired…).
 * Local UI state only: the tab must stay open while it sends.
 */
export function useCampaignSender(getToken, { gapMs = 250 } = {}) {
  const [run, setRun] = useState(null);
  const stopRef = useRef(false);

  const start = useCallback(
    async (campaign, recipients) => {
      stopRef.current = false;
      const state = {
        running: true,
        total: recipients.length,
        done: 0,
        sent: 0,
        failed: 0,
        stopped: false,
        fatal: null,
        results: {},
      };
      setRun({ ...state });

      for (const customer of recipients) {
        if (stopRef.current) {
          state.stopped = true;
          break;
        }
        const token = getToken();
        const result = token
          ? await sendCampaignMessage(token, {
              to: customer.mobile,
              customerName: customer.firstName || customer.name,
              campaign,
            })
          : noToken;
        state.done += 1;
        if (result.success) state.sent += 1;
        else state.failed += 1;
        state.results = {
          ...state.results,
          [customer.id]: result.success
            ? { ok: true, messageId: result.messageId }
            : { ok: false, error: result.error, detail: result.detail },
        };
        setRun({ ...state });
        if (!result.success && isFatalSendError(result)) {
          state.fatal = result.error;
          state.stopped = true;
          break;
        }
        if (gapMs) await pause(gapMs);
      }

      const final = { ...state, running: false };
      setRun(final);
      recordCampaign({
        id: `c${Date.now()}`,
        name: campaign.name,
        template: campaign.binding?.name || campaign.template,
        at: new Date().toISOString(),
        total: final.total,
        sent: final.sent,
        failed: final.failed,
        stopped: final.stopped,
      });
      return final;
    },
    [getToken, gapMs],
  );

  const stop = useCallback(() => {
    stopRef.current = true;
  }, []);
  const reset = useCallback(() => setRun(null), []);

  return { run, start, stop, reset };
}
