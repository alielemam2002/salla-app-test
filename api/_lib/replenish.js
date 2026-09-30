/**
 * Smart replenishment reminders, per merchant in Upstash Redis:
 * - rp:settings:{m}     settings (template, lead days, daily limit, …)
 * - rp:cycles:{m}       hash productId → { days, name }
 * - rp:items:{m}        hash reminderId → reminder
 * - rp:due:{m}          sorted set: scheduled reminder ids by due time
 * - rp:latest:{m}       hash "customer:product" → newest reminder id
 * - rp:by-order:{m}     hash orderId → [reminder ids] (cancellations)
 * - rp:order:{m}:{id}   dedupe key (Salla retries webhooks)
 * - rp:count:{m}:{day}  messages sent that Riyadh day
 * - rp:lock:{m}         one run at a time
 * - rp:merchants        merchants who switched automatic sending on
 *
 * Scheduling needs no Salla API call: order.created carries the customer's
 * number and each product's name and link. Sending uses the merchant's own
 * WhatsApp account (whatsappSettings) and the replenish template.
 *
 * Meta's rules: outside the 24-hour window only approved templates are
 * delivered (so this only sends the template); customers must have opted in
 * (the merchant confirms before switching on); after error 131049 wait 24
 * hours; a daily cap keeps within the messaging limit.
 */

import {
  kvDel,
  kvGetJson,
  kvGetNumber,
  kvHashDel,
  kvHashGetAllJson,
  kvHashGetJson,
  kvHashSetJson,
  kvIncr,
  kvSetAdd,
  kvSetIfAbsent,
  kvSetJson,
  kvSetMembers,
  kvSetRemove,
  kvZAdd,
  kvZRangeByScore,
  kvZRem,
} from "./kv.js";
import {
  buildTemplateMessage,
  cleanParam,
  metaFailure,
  sendTemplate,
} from "./whatsappGraph.js";
import {
  LANGUAGE_RE,
  TEMPLATE_NAME_RE,
  resolveConfig,
} from "./whatsappSettings.js";
import { customerMobile } from "../customers.js";
import { sallaDateMs } from "../../src/utils/cartRecovery/cartModel.js";
import { whatsappNumber } from "../../src/utils/cartRecovery/whatsappMessage.js";
import {
  DAILY_LIMIT_OPTIONS,
  DAY_MS,
  LEAD_OPTIONS,
  REPLENISH_DEFAULTS,
  REPLENISH_VARIABLE_KEYS,
  isCycleDays,
  reminderDueAt,
} from "../../src/utils/replenish/replenishModel.js";

const key = {
  settings: (m) => `rp:settings:${m}`,
  cycles: (m) => `rp:cycles:${m}`,
  items: (m) => `rp:items:${m}`,
  due: (m) => `rp:due:${m}`,
  latest: (m) => `rp:latest:${m}`,
  byOrder: (m) => `rp:by-order:${m}`,
  order: (m, id) => `rp:order:${m}:${id}`,
  count: (m, day) => `rp:count:${m}:${day}`,
  lock: (m) => `rp:lock:${m}`,
  merchants: "rp:merchants",
};

const DEDUPE_SECONDS = 30 * 24 * 60 * 60;
const LOCK_SECONDS = 120;
const KEEP_MS = 90 * DAY_MS; // finished reminders kept for the history
const MAX_ATTEMPTS = 3;
// The function may run 60 s (config in api/replenish.js).
export const RUN_BUDGET_MS = 45_000;

// Meta errors that will repeat for every customer: stop this run.
const STOP_CODES = new Set([
  0, 10, 100, 190, 200, 130429, 131031, 131042, 132000, 132001, 132012, 133010,
]);

/** Store day (Riyadh, UTC+3, no DST) for the daily counter. */
export const riyadhDay = (now = Date.now()) =>
  new Date(now + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

const iso = (ms) => new Date(ms).toISOString();

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function loadSettings(merchantId) {
  return kvGetJson(key.settings(merchantId));
}

const inOptions = (options, value) => options.some((o) => o.value === value);

/** Returns { values } or { fields: { name: [message] } }. */
export function validateSettings(input = {}) {
  const fields = {};
  const template = String(input.template || "").trim();
  const language = String(input.language || "").trim();
  const params = Array.isArray(input.params)
    ? input.params.map((p) => String(p).trim()).filter(Boolean)
    : [];
  const leadDays = Number(input.leadDays);
  const dailyLimit = Number(input.dailyLimit);
  const couponCode = String(input.couponCode || "").trim();

  if (template && !TEMPLATE_NAME_RE.test(template)) {
    fields.template = [
      "اسم القالب يتكون من أحرف إنجليزية صغيرة وأرقام و _ فقط",
    ];
  }
  if (!LANGUAGE_RE.test(language)) {
    fields.language = ["استخدم رمز لغة مثل ar أو en_US"];
  }
  const unknown = params.filter((p) => !REPLENISH_VARIABLE_KEYS.has(p));
  if (unknown.length)
    fields.params = [`متغيرات غير معروفة: ${unknown.join(", ")}`];
  else if (params.length > 10) fields.params = ["الحد الأقصى 10 متغيرات"];
  if (!inOptions(LEAD_OPTIONS, leadDays)) {
    fields.leadDays = ["اختر قيمة من القائمة"];
  }
  if (!inOptions(DAILY_LIMIT_OPTIONS, dailyLimit)) {
    fields.dailyLimit = ["اختر قيمة من القائمة"];
  }
  if (couponCode && !/^[\w-]{1,40}$/.test(couponCode)) {
    fields.couponCode = ["كود الكوبون غير صالح"];
  }
  if (input.enabled === true && !template) {
    fields.template = ["اكتب اسم القالب المعتمد قبل التفعيل"];
  }
  if (Object.keys(fields).length) return { fields };
  return {
    values: {
      enabled: input.enabled === true,
      template,
      language,
      params,
      leadDays,
      dailyLimit,
      couponCode,
    },
  };
}

/** Save; the merchant's opt-in confirmation is kept once given. */
export async function saveSettings(merchantId, values, { stored, consent }) {
  const record = {
    ...values,
    consentAt: stored?.consentAt || (consent ? iso(Date.now()) : null),
    lastRun: stored?.lastRun || null,
    updatedAt: iso(Date.now()),
  };
  await kvSetJson(key.settings(merchantId), record);
  if (record.enabled) await kvSetAdd(key.merchants, merchantId);
  else await kvSetRemove(key.merchants, merchantId);
  return record;
}

export function publicSettings(record) {
  return {
    ...REPLENISH_DEFAULTS,
    ...(record || {}),
    enabled: record?.enabled === true,
    consentAt: record?.consentAt || null,
    lastRun: record?.lastRun || null,
  };
}

export function sentToday(merchantId, now = Date.now()) {
  return kvGetNumber(key.count(merchantId, riyadhDay(now)));
}

// ---------------------------------------------------------------------------
// Consumption cycles per product
// ---------------------------------------------------------------------------

export function listCycles(merchantId) {
  return kvHashGetAllJson(key.cycles(merchantId));
}

/** days = null removes the product's cycle. */
export async function setCycle(merchantId, productId, days, name) {
  if (days === null) {
    await kvHashDel(key.cycles(merchantId), [productId]);
    return null;
  }
  const cycle = {
    days,
    name: cleanParam(name, 200) || null,
    updatedAt: iso(Date.now()),
  };
  await kvHashSetJson(key.cycles(merchantId), productId, cycle);
  return cycle;
}

export { isCycleDays };

// ---------------------------------------------------------------------------
// Scheduling (webhooks)
// ---------------------------------------------------------------------------

function safeUrl(url) {
  const value = String(url || "").trim();
  if (!/^https:\/\//i.test(value)) return null;
  try {
    // Arabic product slugs: keep the link intact inside a WhatsApp message.
    return encodeURI(decodeURI(value));
  } catch {
    return null;
  }
}

/** order.created data → reminders for products that have a cycle. */
export async function scheduleFromOrder(merchantId, order, now = Date.now()) {
  const orderId = String(order?.id ?? "");
  if (!orderId) return 0;
  const cycles = await listCycles(merchantId);
  const items = (Array.isArray(order.items) ? order.items : []).filter(
    (item) => cycles[String(item?.product?.id ?? "")],
  );
  if (!items.length) return 0;

  const dedupe = key.order(merchantId, orderId);
  if (!(await kvSetIfAbsent(dedupe, "1", DEDUPE_SECONDS))) return 0;
  try {
    const customer = order.customer || {};
    const mobile = customerMobile(customer.mobile, customer.mobile_code);
    if (!whatsappNumber(mobile)) return 0; // nobody to remind
    const settings = publicSettings(await loadSettings(merchantId));
    const orderedAt = sallaDateMs(order.date) || now;
    const customerKey = String(customer.id || mobile);

    // A product can appear once per variant: one reminder per product.
    const byProduct = new Map();
    for (const item of items) {
      const productId = String(item.product.id);
      const prev = byProduct.get(productId);
      byProduct.set(productId, {
        quantity: (prev?.quantity || 0) + (Number(item.quantity) || 1),
        name: item.product.name || item.name || cycles[productId].name,
        url: safeUrl(item.product.url),
      });
    }

    const ids = [];
    for (const [productId, line] of byProduct) {
      const cycle = cycles[productId];
      const id = `${orderId}:${productId}`;
      const reminder = {
        id,
        orderId,
        orderRef: order.reference_id ?? null,
        customerId: customer.id ?? null,
        customerName: String(customer.first_name || "").trim() || null,
        mobile,
        productId,
        productName: line.name || null,
        productUrl: line.url,
        quantity: line.quantity,
        cycleDays: cycle.days,
        orderedAt: iso(orderedAt),
        dueAt: iso(
          reminderDueAt(
            orderedAt,
            cycle.days,
            line.quantity,
            settings.leadDays,
          ),
        ),
        status: "scheduled",
        attempts: 0,
        updatedAt: iso(now),
      };

      // Bought again: the older reminder for this product is no longer due.
      const latestKey = `${customerKey}:${productId}`;
      const previous = await kvHashGetJson(key.latest(merchantId), latestKey);
      if (previous && previous !== id) {
        await finish(merchantId, previous, { status: "superseded" });
      }

      await kvHashSetJson(key.items(merchantId), id, reminder);
      await kvZAdd(key.due(merchantId), Date.parse(reminder.dueAt), id);
      await kvHashSetJson(key.latest(merchantId), latestKey, id);
      ids.push(id);
    }
    await kvHashSetJson(key.byOrder(merchantId), orderId, ids);
    return ids.length;
  } catch (error) {
    await kvDel(dedupe); // let Salla's retry schedule it
    throw error;
  }
}

/** Mark a reminder done (sent / cancelled / …) and take it off the queue. */
async function finish(merchantId, id, patch) {
  const reminder = await kvHashGetJson(key.items(merchantId), id);
  if (!reminder || reminder.status !== "scheduled") return null;
  const next = { ...reminder, ...patch, updatedAt: iso(Date.now()) };
  await kvHashSetJson(key.items(merchantId), id, next);
  await kvZRem(key.due(merchantId), id);
  return next;
}

/** order.cancelled / refunded / deleted: drop that order's reminders. */
export async function cancelOrderReminders(merchantId, orderId) {
  const ids =
    (await kvHashGetJson(key.byOrder(merchantId), String(orderId ?? ""))) || [];
  let cancelled = 0;
  for (const id of ids) {
    if (await finish(merchantId, id, { status: "cancelled" })) cancelled += 1;
  }
  return cancelled;
}

export async function cancelReminder(merchantId, id) {
  return finish(merchantId, id, { status: "cancelled" });
}

/** Scheduled first (soonest due), then the rest (latest first). */
export async function listReminders(merchantId, limit = 100) {
  const all = Object.values(await kvHashGetAllJson(key.items(merchantId)));
  const scheduled = all
    .filter((r) => r.status === "scheduled")
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const done = all
    .filter((r) => r.status !== "scheduled")
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return [...scheduled, ...done].slice(0, limit);
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

const FALLBACK_NAME = { ar: "عميلنا العزيز", en: "there" };

/** Template values for one reminder (or sample values for a test). */
export function reminderValues(reminder, settings) {
  const locale = String(settings.language).startsWith("ar") ? "ar" : "en";
  return {
    customer_name: cleanParam(
      reminder.customerName || FALLBACK_NAME[locale],
      60,
    ),
    product_name: cleanParam(reminder.productName, 200),
    product_url: reminder.productUrl || "",
    coupon_code: settings.couponCode || "",
  };
}

/** The merchant's account + the replenish template. */
export function templateConfig(account, settings) {
  return {
    ...account,
    template: settings.template,
    language: settings.language,
    params: settings.params,
    invalidParams: [],
  };
}

/**
 * Send one message. Resolves to { ok, messageId } or
 * { ok: false, error, metaCode?, stop? } (stop: the next ones would fail too).
 */
export async function sendMessage(config, to, values) {
  const message = buildTemplateMessage(config, to, values);
  if (message.error) return { ok: false, error: message.error, stop: true };
  const result = await sendTemplate(config, message.body);
  if (result.ok) {
    return { ok: true, messageId: result.json.messages?.[0]?.id || null };
  }
  const failure = metaFailure(result);
  return {
    ok: false,
    error: failure.error,
    metaCode: failure.metaCode,
    stop: STOP_CODES.has(failure.metaCode),
  };
}

/** Send one scheduled reminder now and record the outcome. */
async function deliver(merchantId, reminder, config, settings) {
  const to = whatsappNumber(reminder.mobile);
  if (!to) {
    await finish(merchantId, reminder.id, {
      status: "skipped",
      error: "لا يوجد رقم جوال دولي",
    });
    return { ok: false, error: "لا يوجد رقم جوال دولي" };
  }
  const result = await sendMessage(
    config,
    to,
    reminderValues(reminder, settings),
  );
  const now = Date.now();
  if (result.ok) {
    await finish(merchantId, reminder.id, {
      status: "sent",
      sentAt: iso(now),
      messageId: result.messageId,
      error: null,
    });
    await kvIncr(key.count(merchantId, riyadhDay(now)), 2 * 24 * 60 * 60);
    return result;
  }
  if (result.stop) return result; // config problem: stays scheduled
  if (result.metaCode === 131026) {
    await finish(merchantId, reminder.id, {
      status: "skipped",
      error: result.error,
    });
    return result;
  }
  const attempts = (reminder.attempts || 0) + 1;
  // 131049 is Meta's per-customer marketing limit: worth a week of retries.
  const limit = result.metaCode === 131049 ? 7 : MAX_ATTEMPTS;
  if (attempts >= limit) {
    await finish(merchantId, reminder.id, {
      status: "failed",
      attempts,
      error: result.error,
    });
    return result;
  }
  // 131049 (per-user marketing limit): Meta asks to wait 24 hours.
  const next = {
    ...reminder,
    attempts,
    error: result.error,
    dueAt: iso(now + DAY_MS),
    updatedAt: iso(now),
  };
  await kvHashSetJson(key.items(merchantId), reminder.id, next);
  await kvZAdd(key.due(merchantId), now + DAY_MS, reminder.id);
  return result;
}

/** What still stops sending for this merchant (Arabic), or null. */
export async function sendingBlocker(merchantId, settings) {
  const { config, enabled, unreadable } = await resolveConfig(merchantId);
  if (!config) {
    return {
      code: "whatsapp_not_configured",
      error: unreadable
        ? "أدخل رمز الوصول لواتساب مرة أخرى في إعدادات واتساب."
        : "اربط حساب واتساب للأعمال من إعدادات واتساب أولًا.",
    };
  }
  if (!enabled) {
    return {
      code: "whatsapp_disabled",
      error: "مفتاح «الإرسال من التطبيق» في صفحة السلات المتروكة متوقف.",
    };
  }
  if (!settings.template) {
    return { code: "no_template", error: "اكتب اسم القالب المعتمد أولًا." };
  }
  return { config };
}

/** "Send now" for one reminder, from the app. */
export async function sendNow(merchantId, id) {
  const settings = publicSettings(await loadSettings(merchantId));
  const ready = await sendingBlocker(merchantId, settings);
  if (!ready.config) return { ok: false, ...ready };
  const reminder = await kvHashGetJson(key.items(merchantId), id);
  if (!reminder || reminder.status !== "scheduled") {
    return {
      ok: false,
      code: "not_found",
      error: "هذا التذكير لم يعد مجدولًا.",
    };
  }
  return deliver(
    merchantId,
    reminder,
    templateConfig(ready.config, settings),
    settings,
  );
}

const stop = (code, message) => ({ code, message });

/** The daily run for one merchant; saves and returns the summary. */
export async function runDue(
  merchantId,
  { deadline = Date.now() + RUN_BUDGET_MS, trigger = "cron" } = {},
) {
  const stored = await loadSettings(merchantId);
  const settings = publicSettings(stored);
  if (!settings.enabled) {
    return { stopped: stop("disabled", "الإرسال التلقائي متوقف.") };
  }
  if (!(await kvSetIfAbsent(key.lock(merchantId), "1", LOCK_SECONDS))) {
    return { stopped: stop("busy", "يوجد تشغيل آخر قيد التنفيذ.") };
  }
  const tally = { sent: 0, failed: 0, remaining: 0, stopped: null };
  try {
    const ready = await sendingBlocker(merchantId, settings);
    const allowance = settings.dailyLimit - (await sentToday(merchantId));
    if (!ready.config) {
      tally.stopped = stop(ready.code, ready.error);
    } else if (allowance <= 0) {
      tally.stopped = stop("daily_limit", "تم الوصول إلى الحد اليومي للرسائل.");
    } else {
      const config = templateConfig(ready.config, settings);
      const ids = await kvZRangeByScore(
        key.due(merchantId),
        0,
        Date.now(),
        allowance,
      );
      for (let i = 0; i < ids.length; i += 1) {
        if (Date.now() > deadline) {
          tally.stopped = stop(
            "time_budget",
            "انتهى وقت التشغيل؛ سيكمل التشغيل القادم.",
          );
          tally.remaining = ids.length - i;
          break;
        }
        const reminder = await kvHashGetJson(key.items(merchantId), ids[i]);
        if (!reminder || reminder.status !== "scheduled") {
          await kvZRem(key.due(merchantId), ids[i]);
          continue;
        }
        const result = await deliver(merchantId, reminder, config, settings);
        if (result.ok) tally.sent += 1;
        else tally.failed += 1;
        if (result.stop) {
          tally.stopped = stop("meta_error", result.error);
          tally.remaining = ids.length - i - 1;
          break;
        }
      }
    }
    await pruneHistory(merchantId);
  } catch (error) {
    console.error("Replenish run failed:", error.code || error.message);
    tally.stopped = stop(error.code || "server_error", error.message);
  } finally {
    await kvDel(key.lock(merchantId));
  }
  const lastRun = { at: iso(Date.now()), trigger, ...tally };
  const current = await loadSettings(merchantId);
  if (current)
    await kvSetJson(key.settings(merchantId), { ...current, lastRun });
  return lastRun;
}

/** Finished reminders older than KEEP_MS leave the history. */
async function pruneHistory(merchantId) {
  const all = await kvHashGetAllJson(key.items(merchantId));
  const old = Object.values(all)
    .filter(
      (r) =>
        r.status !== "scheduled" &&
        Date.now() - Date.parse(r.updatedAt) > KEEP_MS,
    )
    .map((r) => r.id);
  await kvHashDel(key.items(merchantId), old);
}

/** The cron: every merchant who switched automatic reminders on. */
export async function runAll({ deadline }) {
  const merchants = await kvSetMembers(key.merchants);
  const results = {};
  for (const merchantId of merchants) {
    if (Date.now() > deadline) {
      results[merchantId] = { stopped: "time_budget" };
      continue;
    }
    const run = await runDue(merchantId, { deadline });
    if (run.stopped?.code === "disabled") {
      await kvSetRemove(key.merchants, merchantId);
    }
    // Counts only: no customer data in the logs.
    results[merchantId] = {
      sent: run.sent || 0,
      failed: run.failed || 0,
      stopped: run.stopped?.code || null,
    };
  }
  return { merchants: merchants.length, results };
}
