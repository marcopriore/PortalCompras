import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getPasswordPolicyDefinition,
  isPasswordPolicyKey,
  PASSWORD_POLICY_REGISTRY,
  type PasswordPolicy,
  type PasswordPolicyKey,
} from "@/lib/settings/password-policy-registry"

function parseBoolean(raw: string | null | undefined, fallback: boolean): boolean {
  if (raw == null || String(raw).trim() === "") return fallback
  const v = String(raw).trim().toLowerCase()
  if (v === "1" || v === "true" || v === "yes") return true
  if (v === "0" || v === "false" || v === "no") return false
  return fallback
}

function parseNumber(
  raw: string | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw == null || String(raw).trim() === "") return fallback
  const n = Number(String(raw).trim().replace(",", "."))
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function buildDefaultPasswordPolicy(): PasswordPolicy {
  const def = PASSWORD_POLICY_REGISTRY
  const getNum = (key: PasswordPolicyKey) =>
    getPasswordPolicyDefinition(key)!.defaultValue as number
  const getBool = (key: PasswordPolicyKey) =>
    getPasswordPolicyDefinition(key)!.defaultValue as boolean

  return {
    minLength: getNum("password_min_length"),
    requireUppercase: getBool("password_require_uppercase"),
    requireLowercase: getBool("password_require_lowercase"),
    requireDigit: getBool("password_require_digit"),
    requireSpecial: getBool("password_require_special"),
    expiryDays: getNum("password_expiry_days"),
    historyCount: getNum("password_history_count"),
  }
}

export function passwordPolicyFromSettings(
  raw: Partial<Record<PasswordPolicyKey, string | null>>,
): PasswordPolicy {
  const defaults = buildDefaultPasswordPolicy()
  const defMin = getPasswordPolicyDefinition("password_min_length")!
  const defExpiry = getPasswordPolicyDefinition("password_expiry_days")!
  const defHistory = getPasswordPolicyDefinition("password_history_count")!

  return {
    minLength: parseNumber(
      raw.password_min_length,
      defaults.minLength,
      defMin.min!,
      defMin.max!,
    ),
    requireUppercase: parseBoolean(
      raw.password_require_uppercase,
      defaults.requireUppercase,
    ),
    requireLowercase: parseBoolean(
      raw.password_require_lowercase,
      defaults.requireLowercase,
    ),
    requireDigit: parseBoolean(raw.password_require_digit, defaults.requireDigit),
    requireSpecial: parseBoolean(
      raw.password_require_special,
      defaults.requireSpecial,
    ),
    expiryDays: parseNumber(
      raw.password_expiry_days,
      defaults.expiryDays,
      defExpiry.min!,
      defExpiry.max!,
    ),
    historyCount: parseNumber(
      raw.password_history_count,
      defaults.historyCount,
      defHistory.min!,
      defHistory.max!,
    ),
  }
}

export function serializePasswordPolicyValue(
  key: PasswordPolicyKey,
  value: number | boolean,
): string {
  const def = getPasswordPolicyDefinition(key)
  if (!def) return String(value)
  if (def.type === "boolean") return value ? "1" : "0"
  return String(Math.round(Number(value)))
}

export function validatePasswordPolicyPatch(
  key: string,
  value: unknown,
): { ok: true; parsed: number | boolean } | { ok: false; error: string } {
  if (!isPasswordPolicyKey(key)) {
    return { ok: false, error: `Configuração desconhecida: ${key}` }
  }
  const def = getPasswordPolicyDefinition(key)!
  if (def.type === "boolean") {
    if (typeof value === "boolean") return { ok: true, parsed: value }
    if (value === 1 || value === "1" || value === "true") {
      return { ok: true, parsed: true }
    }
    if (value === 0 || value === "0" || value === "false") {
      return { ok: true, parsed: false }
    }
    return { ok: false, error: `${def.label}: valor booleano inválido` }
  }

  const n =
    typeof value === "number"
      ? value
      : Number(String(value).trim().replace(",", "."))
  if (Number.isNaN(n)) {
    return { ok: false, error: `${def.label}: valor numérico inválido` }
  }
  const rounded = Math.round(n)
  if (rounded < (def.min ?? 0) || rounded > (def.max ?? 9999)) {
    return {
      ok: false,
      error: `${def.label} deve estar entre ${def.min} e ${def.max}`,
    }
  }
  return { ok: true, parsed: rounded }
}

export async function loadPasswordPolicy(
  supabase: SupabaseClient,
  companyId: string,
): Promise<PasswordPolicy> {
  const { data, error } = await supabase
    .from("company_settings")
    .select("key, value")
    .eq("company_id", companyId)
    .in("key", PASSWORD_POLICY_REGISTRY.map((d) => d.key))

  if (error) {
    console.error("loadPasswordPolicy:", error)
    return buildDefaultPasswordPolicy()
  }

  const raw: Partial<Record<PasswordPolicyKey, string | null>> = {}
  for (const row of data ?? []) {
    const key = String(row.key)
    if (!isPasswordPolicyKey(key)) continue
    raw[key] = row.value as string | null
  }
  return passwordPolicyFromSettings(raw)
}

export async function seedDefaultPasswordPolicy(
  supabase: SupabaseClient,
  companyId: string,
): Promise<void> {
  const defaults = buildDefaultPasswordPolicy()
  const rows = PASSWORD_POLICY_REGISTRY.map((def) => {
    let value: number | boolean
    switch (def.key) {
      case "password_min_length":
        value = defaults.minLength
        break
      case "password_require_uppercase":
        value = defaults.requireUppercase
        break
      case "password_require_lowercase":
        value = defaults.requireLowercase
        break
      case "password_require_digit":
        value = defaults.requireDigit
        break
      case "password_require_special":
        value = defaults.requireSpecial
        break
      case "password_expiry_days":
        value = defaults.expiryDays
        break
      case "password_history_count":
        value = defaults.historyCount
        break
      default:
        value = def.defaultValue as number | boolean
    }
    return {
      company_id: companyId,
      key: def.key,
      value: serializePasswordPolicyValue(def.key, value),
    }
  })

  const { error } = await supabase
    .from("company_settings")
    .upsert(rows, { onConflict: "company_id,key" })

  if (error) throw error
}

export function isPasswordExpired(
  passwordChangedAt: string | null | undefined,
  policy: PasswordPolicy,
  now: Date = new Date(),
): boolean {
  if (policy.expiryDays <= 0) return false
  if (!passwordChangedAt) return true
  const changed = new Date(passwordChangedAt)
  if (Number.isNaN(changed.getTime())) return true
  const msPerDay = 24 * 60 * 60 * 1000
  const elapsedDays = (now.getTime() - changed.getTime()) / msPerDay
  return elapsedDays >= policy.expiryDays
}

export function daysUntilPasswordExpiry(
  passwordChangedAt: string | null | undefined,
  policy: PasswordPolicy,
  now: Date = new Date(),
): number | null {
  if (policy.expiryDays <= 0) return null
  if (!passwordChangedAt) return 0
  const changed = new Date(passwordChangedAt)
  if (Number.isNaN(changed.getTime())) return 0
  const msPerDay = 24 * 60 * 60 * 1000
  const elapsedDays = (now.getTime() - changed.getTime()) / msPerDay
  return Math.ceil(policy.expiryDays - elapsedDays)
}
