import { randomBytes, scryptSync, timingSafeEqual } from "crypto"

const SCRYPT_KEYLEN = 64

export function hashPasswordForHistory(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPasswordAgainstHistoryHash(
  password: string,
  stored: string,
): boolean {
  const [salt, expectedHex] = stored.split(":")
  if (!salt || !expectedHex) return false
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex")
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedHex, "hex"))
  } catch {
    return false
  }
}
