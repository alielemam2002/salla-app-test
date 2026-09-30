/**
 * Minimal Upstash Redis client over its REST API (no dependency):
 * POST <url> with the command as a JSON array, `Authorization: Bearer`.
 * docs: https://upstash.com/docs/redis/features/restapi
 *
 * Env: KV_REST_API_URL / KV_REST_API_TOKEN (set by the Vercel Upstash
 * integration) or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
 */

function credentials(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || "";
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || "";
  return { url: url.replace(/\/+$/, ""), token };
}

export function kvConfigured(env = process.env) {
  const { url, token } = credentials(env);
  return Boolean(url && token);
}

async function command(args) {
  const { url, token } = credentials();
  if (!url || !token) {
    const error = new Error(
      "Storage isn't set up: add Upstash Redis to the Vercel project (KV_REST_API_URL / KV_REST_API_TOKEN).",
    );
    error.code = "storage_not_configured";
    error.status = 503;
    throw error;
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  let body = {};
  try {
    body = await response.json();
  } catch {
    // handled below
  }
  if (!response.ok || body.error) {
    const error = new Error("Storage request failed");
    error.code = "storage_error";
    error.status = 502;
    throw error;
  }
  return body.result;
}

/** Stored JSON value, or null when the key doesn't exist. */
export async function kvGetJson(key) {
  const raw = await command(["GET", key]);
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function kvSetJson(key, value) {
  await command(["SET", key, JSON.stringify(value)]);
}

export async function kvDel(key) {
  await command(["DEL", key]);
}

/** SET NX with an expiry: true only for the first caller (dedupe/lock). */
export async function kvSetIfAbsent(key, value, ex) {
  const result = await command(["SET", key, value, "NX", "EX", String(ex)]);
  return result === "OK";
}

export async function kvGetNumber(key) {
  const n = Number(await command(["GET", key]));
  return Number.isFinite(n) ? n : 0;
}

/** INCR and (re)set the expiry, so a counter never outlives `ex` seconds. */
export async function kvIncr(key, ex) {
  const value = await command(["INCR", key]);
  await command(["EXPIRE", key, String(ex)]);
  return Number(value) || 0;
}

export async function kvSetAdd(key, member) {
  await command(["SADD", key, String(member)]);
}

export async function kvSetRemove(key, member) {
  await command(["SREM", key, String(member)]);
}

export async function kvSetMembers(key) {
  const members = await command(["SMEMBERS", key]);
  return Array.isArray(members) ? members.map(String) : [];
}

const parseOrNull = (raw) => {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export async function kvHashGetJson(key, field) {
  return parseOrNull(await command(["HGET", key, String(field)]));
}

export async function kvHashSetJson(key, field, value) {
  await command(["HSET", key, String(field), JSON.stringify(value)]);
}

export async function kvHashDel(key, fields) {
  if (fields.length) await command(["HDEL", key, ...fields.map(String)]);
}

/** Every field of a hash as { field: parsed JSON } (bad JSON is skipped). */
export async function kvHashGetAllJson(key) {
  const raw = await command(["HGETALL", key]);
  // The REST API answers HGETALL with [field, value, field, value, …].
  const pairs = Array.isArray(raw)
    ? raw.flatMap((item, i) => (i % 2 === 0 ? [[item, raw[i + 1]]] : []))
    : Object.entries(raw || {});
  const out = {};
  for (const [field, value] of pairs) {
    const parsed = parseOrNull(value);
    if (parsed !== null) out[field] = parsed;
  }
  return out;
}

/** Sorted set: add/move `member` to `score`. */
export async function kvZAdd(key, score, member) {
  await command(["ZADD", key, String(score), String(member)]);
}

export async function kvZRem(key, member) {
  await command(["ZREM", key, String(member)]);
}

/** Members with min <= score <= max, lowest first, at most `limit`. */
export async function kvZRangeByScore(key, min, max, limit) {
  const members = await command([
    "ZRANGEBYSCORE",
    key,
    String(min),
    String(max),
    "LIMIT",
    "0",
    String(limit),
  ]);
  return Array.isArray(members) ? members.map(String) : [];
}

/** LPUSH JSON values (in order, newest last) and keep the newest `max`. */
export async function kvListPushJson(key, values, max) {
  if (!values.length) return;
  await command(["LPUSH", key, ...values.map((v) => JSON.stringify(v))]);
  await command(["LTRIM", key, "0", String(max - 1)]);
}

/** Items `start`..`stop` (newest first), parsed; bad JSON is skipped. */
export async function kvListRangeJson(key, start, stop) {
  const raw = await command(["LRANGE", key, String(start), String(stop)]);
  return (Array.isArray(raw) ? raw : []).flatMap((item) => {
    try {
      return [JSON.parse(item)];
    } catch {
      return [];
    }
  });
}
