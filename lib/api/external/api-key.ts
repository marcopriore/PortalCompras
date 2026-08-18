import { createHash, randomBytes, timingSafeEqual } from "crypto"

const KEY_PREFIX_LABEL = "valore_"
const VISIBLE_PREFIX_LENGTH = 12

function pepper(): string {
  return process.env.API_KEY_PEPPER ?? ""
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256")
    .update(`${pepper()}:${rawKey}`)
    .digest("hex")
}

export function verifyApiKey(rawKey: string, storedHash: string): boolean {
  const computed = hashApiKey(rawKey)
  try {
    return timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(storedHash, "hex"),
    )
  } catch {
    return false
  }
}

export type GeneratedApiKey = {
  rawKey: string
  keyPrefix: string
  keyHash: string
}

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(32).toString("base64url")
  const rawKey = `${KEY_PREFIX_LABEL}${secret}`
  const keyPrefix = rawKey.slice(0, VISIBLE_PREFIX_LENGTH)
  return {
    rawKey,
    keyPrefix,
    keyHash: hashApiKey(rawKey),
  }
}

export function isApiKeyFormat(value: string): boolean {
  return value.startsWith(KEY_PREFIX_LABEL) && value.length > KEY_PREFIX_LABEL.length + 16
}
