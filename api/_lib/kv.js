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
