import { describe, expect, it } from "vitest"
import {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  isApiKeyFormat,
} from "@/lib/api/external/api-key"
import { isApiScope, parseApiScopes } from "@/lib/api/external/scopes"

describe("api-key", () => {
  it("gera chave no formato valore_", () => {
    const { rawKey, keyPrefix, keyHash } = generateApiKey()
    expect(rawKey.startsWith("valore_")).toBe(true)
    expect(keyPrefix).toBe(rawKey.slice(0, 12))
    expect(keyHash).toHaveLength(64)
    expect(isApiKeyFormat(rawKey)).toBe(true)
  })

  it("verifica hash da chave", () => {
    const { rawKey, keyHash } = generateApiKey()
    expect(verifyApiKey(rawKey, keyHash)).toBe(true)
    expect(verifyApiKey(`${rawKey}x`, keyHash)).toBe(false)
  })

  it("hash é determinístico com mesmo pepper", () => {
    const key = "valore_testkey123456789012345678901234"
    expect(hashApiKey(key)).toBe(hashApiKey(key))
  })
})

describe("api scopes", () => {
  it("filtra escopos válidos", () => {
    expect(parseApiScopes(["items:read", "invalid", "orders:read"])).toEqual([
      "items:read",
      "orders:read",
    ])
    expect(isApiScope("requisitions:write")).toBe(true)
    expect(isApiScope("foo")).toBe(false)
  })
})
