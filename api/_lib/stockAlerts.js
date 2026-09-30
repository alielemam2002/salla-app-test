/**
 * Stock alerts for the merchant. Stored per merchant in Upstash Redis:
 * - alerts:{merchantId}               alerts, newest first (at most 200)
 * - alerts:settings:{merchantId}      { threshold }
 * - alerts:read:{merchantId}          { at } when the merchant last read them
 * - alerts:last-order:{merchantId}    { at, orderId } last order.created seen
 * - alerts:order:{merchantId}:{order} dedupe key (Salla retries webhooks)
 *
 * An alert is written when an order.created webhook arrives and a product
 * in it is at or under the merchant's threshold (read from Salla right
 * after the order). The Alerts tab also scans the products list directly.
 */

import {
  kvDel,
  kvGetJson,
  kvListPushJson,
  kvListRangeJson,
  kvSetIfAbsent,
  kvSetJson,
} from "./kv.js";
import { merchantApi } from "./salla.js";
import {
  DEFAULT_THRESHOLD,
  isThreshold,
  stockLevel,
} from "../../src/utils/alerts/stockModel.js";

const alertsKey = (merchantId) => `alerts:${merchantId}`;
const settingsKey = (merchantId) => `alerts:settings:${merchantId}`;
const readKey = (merchantId) => `alerts:read:${merchantId}`;
const lastOrderKey = (merchantId) => `alerts:last-order:${merchantId}`;
const orderKey = (merchantId, orderId) =>
  `alerts:order:${merchantId}:${orderId}`;

export const MAX_ALERTS = 200;
const MAX_LOOKUPS = 20; // products read per order
const DEDUPE_SECONDS = 7 * 24 * 60 * 60;
const MAX_PAGES = 10; // 600 products for the stock scan
const PER_PAGE = 60;

export async function loadAlertSettings(merchantId) {
  const stored = await kvGetJson(settingsKey(merchantId));
  return {
    threshold: isThreshold(stored?.threshold)
      ? stored.threshold
      : DEFAULT_THRESHOLD,
  };
}

export async function saveAlertSettings(merchantId, threshold) {
  const settings = { threshold };
  await kvSetJson(settingsKey(merchantId), settings);
  return settings;
}

export function listAlerts(merchantId, limit = 50) {
  return kvListRangeJson(alertsKey(merchantId), 0, limit - 1);
}

export async function lastReadAt(merchantId) {
  return (await kvGetJson(readKey(merchantId)))?.at || null;
}

export async function markRead(merchantId) {
  const at = new Date().toISOString();
  await kvSetJson(readKey(merchantId), { at });
  return at;
}

export async function clearAlerts(merchantId) {
  await kvDel(alertsKey(merchantId));
  return markRead(merchantId);
}

export async function lastOrder(merchantId) {
  return kvGetJson(lastOrderKey(merchantId));
}

const customerName = (customer) =>
  [customer?.first_name, customer?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() ||
  customer?.name ||
  null;

/** Order lines grouped by product (a product can appear once per variant). */
function orderedProducts(order) {
  const byProduct = new Map();
  for (const item of Array.isArray(order?.items) ? order.items : []) {
    const id = item?.product?.id ?? item?.product_id;
    if (!id) continue;
    const key = String(id);
    const prev = byProduct.get(key);
    byProduct.set(key, {
      name: prev?.name || item.name || null,
      sku: prev?.sku || item.sku || null,
      ordered: (prev?.ordered || 0) + (Number(item.quantity) || 0),
    });
  }
  return [...byProduct].slice(0, MAX_LOOKUPS);
}

/**
 * order.created data → alerts for products at or under `threshold`. Each
 * product's stock is read from Salla (the order doesn't carry it). Throws
 * when Salla fails, so the webhook can ask Salla to retry.
 */
export async function alertsForOrder(order, threshold, at) {
  const alerts = [];
  for (const [productId, line] of orderedProducts(order)) {
    const { status, body } = await merchantApi(
      `/products/${encodeURIComponent(productId)}`,
    );
    if (status === 404) continue; // deleted since
    if (!body?.success) {
      const error = new Error(`Salla product lookup failed (${status})`);
      error.code = "salla_error";
      throw error;
    }
    const product = body.data || {};
    const kind = stockLevel(product, threshold);
    if (!kind) continue;
    alerts.push({
      id: `${order.id}:${productId}`,
      at,
      kind,
      orderId: order.id ?? null,
      orderRef: order.reference_id ?? null,
      customer: customerName(order.customer),
      productId,
      productName: product.name || line.name,
      sku: product.sku || line.sku,
      ordered: line.ordered,
      quantity: product.quantity ?? null,
    });
  }
  return alerts;
}

/**
 * One order.created delivery. Salla retries failed deliveries, so each
 * order is handled once; on failure the dedupe key is released for the
 * retry. Returns how many alerts were written.
 */
export async function recordOrderAlerts(merchantId, order) {
  const orderId = String(order?.id ?? "");
  if (!orderId) return 0;
  const dedupe = orderKey(merchantId, orderId);
  if (!(await kvSetIfAbsent(dedupe, "1", DEDUPE_SECONDS))) return 0;
  try {
    const at = new Date().toISOString();
    const { threshold } = await loadAlertSettings(merchantId);
    const alerts = await alertsForOrder(order, threshold, at);
    // LPUSH puts the last value first: reverse to keep the order's lines.
    await kvListPushJson(
      alertsKey(merchantId),
      [...alerts].reverse(),
      MAX_ALERTS,
    );
    await kvSetJson(lastOrderKey(merchantId), { at, orderId });
    return alerts.length;
  } catch (error) {
    await kvDel(dedupe);
    throw error;
  }
}

const pickProduct = (product, kind) => ({
  id: product.id,
  name: product.name || null,
  sku: product.sku || null,
  quantity: product.quantity ?? null,
  status: product.status || null,
  thumbnail: product.thumbnail || product.main_image || null,
  kind,
});

/**
 * Products out of stock or at/under `threshold`, from GET /products (up to
 * MAX_PAGES pages). Returns { out, low, scanned, truncated } or { error }.
 */
export async function scanStock(threshold) {
  const out = [];
  const low = [];
  let scanned = 0;
  let lastPage = 0;
  let totalPages = 1;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { status, body } = await merchantApi(
      `/products?page=${page}&per_page=${PER_PAGE}`,
    );
    if (!body?.success) {
      return {
        status,
        error:
          body?.error?.message || `تعذّر تحميل المنتجات (الحالة ${status})`,
      };
    }
    const products = Array.isArray(body.data) ? body.data : [];
    scanned += products.length;
    lastPage = page;
    for (const product of products) {
      const kind = stockLevel(product, threshold);
      if (kind === "out") out.push(pickProduct(product, kind));
      else if (kind === "low") low.push(pickProduct(product, kind));
    }
    totalPages = Number(body.pagination?.totalPages) || 1;
    if (page >= totalPages || !products.length) break;
  }
  low.sort((a, b) => Number(a.quantity) - Number(b.quantity));
  return { out, low, scanned, truncated: lastPage < totalPages };
}
