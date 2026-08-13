import { describe, expect, it } from "vitest"
import {
  validatePasswordAgainstPolicy,
  type PasswordPolicy,
} from "@/lib/settings/password-policy-registry"
import {
  isPasswordExpired,
  daysUntilPasswordExpiry,
  passwordPolicyFromSettings,
} from "@/lib/settings/password-policy"
import { generatePasswordForPolicy } from "@/lib/auth/generate-password"
import {
  hashPasswordForHistory,
  verifyPasswordAgainstHistoryHash,
} from "@/lib/auth/password-hash"

const basePolicy: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
  expiryDays: 90,
  historyCount: 5,
}

describe("validatePasswordAgainstPolicy", () => {
  it("rejeita senha curta", () => {
    const result = validatePasswordAgainstPolicy("Ab1@", basePolicy)
    expect(result.ok).toBe(false)
  })

  it("aceita senha válida", () => {
    const result = validatePasswordAgainstPolicy("Senha@123", basePolicy)
    expect(result.ok).toBe(true)
  })
})

describe("passwordPolicyFromSettings", () => {
  it("interpreta booleanos como 1/0", () => {
    const policy = passwordPolicyFromSettings({
      password_min_length: "10",
      password_require_uppercase: "0",
      password_require_lowercase: "1",
      password_require_digit: "1",
      password_require_special: "1",
      password_expiry_days: "30",
      password_history_count: "3",
    })
    expect(policy.minLength).toBe(10)
    expect(policy.requireUppercase).toBe(false)
    expect(policy.expiryDays).toBe(30)
    expect(policy.historyCount).toBe(3)
  })
})

describe("isPasswordExpired", () => {
  it("não expira quando desabilitado", () => {
    expect(
      isPasswordExpired("2020-01-01T00:00:00Z", {
        ...basePolicy,
        expiryDays: 0,
      }),
    ).toBe(false)
  })

  it("expira após prazo", () => {
    const old = new Date()
    old.setDate(old.getDate() - 100)
    expect(
      isPasswordExpired(old.toISOString(), basePolicy, new Date()),
    ).toBe(true)
  })
})

describe("daysUntilPasswordExpiry", () => {
  it("retorna dias restantes", () => {
    const changed = new Date()
    changed.setDate(changed.getDate() - 10)
    const days = daysUntilPasswordExpiry(changed.toISOString(), basePolicy)
    expect(days).toBeGreaterThan(75)
    expect(days).toBeLessThanOrEqual(80)
  })
})

describe("generatePasswordForPolicy", () => {
  it("gera senha que passa na política", () => {
    const pwd = generatePasswordForPolicy(basePolicy)
    expect(validatePasswordAgainstPolicy(pwd, basePolicy).ok).toBe(true)
  })
})

describe("password hash history", () => {
  it("verifica hash armazenado", () => {
    const hash = hashPasswordForHistory("Senha@123")
    expect(verifyPasswordAgainstHistoryHash("Senha@123", hash)).toBe(true)
    expect(verifyPasswordAgainstHistoryHash("outra", hash)).toBe(false)
  })
})
