/**
 * Minimal Upstash Redis REST client (no dependencies).
 *
 * Reads the connection from the env vars Vercel sets when you add
 * Upstash Redis from the Marketplace (KV_* or UPSTASH_REDIS_REST_* naming).
 * Files under api/_lib are not deployed as functions.
 */

const REDIS_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export function isRedisConfigured() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

/**
 * Run a single Redis command, e.g. redis(["SET", "key", "value"]).
 */
export async function redis(command) {
  if (!isRedisConfigured()) {
    throw new Error(
      "Redis is not configured (missing KV_REST_API_URL / KV_REST_API_TOKEN)",
    );
  }

  const response = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(
      `Redis ${command[0]} failed: ${body.error || response.status}`,
    );
  }
  return body.result;
}
