/**
 * Encrypt secrets (merchants' WhatsApp access tokens) before storing them:
 * AES-256-GCM with a key that only exists in the server environment.
 *
 * Env: WA_SETTINGS_KEY = 32 random bytes, base64 (e.g. `openssl rand -base64 32`).
 * Changing the key makes every stored token unreadable (merchants re-enter
 * their token), so set it once.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(env = process.env) {
  const raw = Buffer.from(String(env.WA_SETTINGS_KEY || ""), "base64");
  if (raw.length !== 32) {
    const error = new Error(
      "WA_SETTINGS_KEY must be 32 random bytes in base64 (openssl rand -base64 32).",
    );
    error.code = "encryption_not_configured";
    error.status = 503;
    throw error;
  }
  return raw;
}

export function encryptionConfigured(env = process.env) {
  try {
    key(env);
    return true;
  } catch {
    return false;
  }
}

/** Plain text → { v, iv, tag, data } (all base64). */
export function seal(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([
    cipher.update(String(plain), "utf8"),
    cipher.final(),
  ]);
  return {
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

/** { v, iv, tag, data } → plain text. Throws if it was tampered with. */
export function open(box) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(box.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(box.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(box.data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
