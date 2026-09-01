import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getTenantSettingDefinition,
  isTenantSettingKey,
  TENANT_SETTINGS_REGISTRY,
  type TenantSettingKey,
} from "@/lib/settings/tenant-settings-registry"
import { digitsFromMaxQuantity } from "@/lib/validation/numeric-input"

export function parseTenantSettingValue(
  key: TenantSettingKey,
  raw: string | null | undefined,
): number {
  const def = getTenantSettingDefinition(key)
  if (!def) return 0

  if (raw == null || String(raw).trim() === "") {
    return def.defaultValue
  }

  const n = Number(String(raw).trim().replace(",", "."))
  if (Number.isNaN(n)) return def.defaultValue

  return Math.min(def.max, Math.max(def.min, Math.round(n)))
}

export function serializeTenantSettingValue(value: number): string {
  return String(Math.round(value))
}

export function validateTenantSettingValue(
  key: string,
  value: unknown,
): { ok: true; parsed: number } | { ok: false; error: string } {
  if (!isTenantSettingKey(key)) {
    return { ok: false, error: `Configuração desconhecida: ${key}` }
  }

  const def = getTenantSettingDefinition(key)!
  const n =
    typeof value === "number"
      ? value
      : Number(String(value).trim().replace(",", "."))

  if (Number.isNaN(n)) {
    return { ok: false, error: `Valor inválido para ${def.label}` }
  }

  const rounded = Math.round(n)
  if (rounded < def.min || rounded > def.max) {
    return {
      ok: false,
      error: `${def.label} deve estar entre ${def.min} e ${def.max}`,
    }
  }

  return { ok: true, parsed: rounded }
}

export function buildDefaultTenantSettings(): Record<TenantSettingKey, number> {
  const out = {} as Record<TenantSettingKey, number>
  for (const def of TENANT_SETTINGS_REGISTRY) {
    out[def.key] = def.defaultValue
  }
  return out
}

export async function seedDefaultTenantSettings(
  supabase: SupabaseClient,
  companyId: string,
): Promise<void> {
  const defaults = buildDefaultTenantSettings()
  const rows = TENANT_SETTINGS_REGISTRY.map((def) => ({
    company_id: companyId,
    key: def.key,
    value: serializeTenantSettingValue(defaults[def.key]),
  }))

  const { error } = await supabase
    .from("company_settings")
    .upsert(rows, { onConflict: "company_id,key" })

  if (error) {
    throw error
  }
}

export async function loadTenantSettings(
  supabase: SupabaseClient,
  companyId: string,
  keys?: TenantSettingKey[],
): Promise<Record<TenantSettingKey, number>> {
  const targetKeys = keys ?? TENANT_SETTINGS_REGISTRY.map((d) => d.key)
  const merged = buildDefaultTenantSettings()

  if (targetKeys.length === 0) return merged

  const queryKeys = [...new Set([...targetKeys, "numeric_max_quantity"])]

  const { data, error } = await supabase
    .from("company_settings")
    .select("key, value")
    .eq("company_id", companyId)
    .in("key", queryKeys)

  if (error) {
    console.error("loadTenantSettings:", error)
    return merged
  }

  let legacyMaxQuantity: number | null = null

  for (const row of data ?? []) {
    const key = String(row.key)
    if (key === "numeric_max_quantity") {
      const n = Number(String(row.value ?? "").trim())
      if (!Number.isNaN(n) && n > 0) legacyMaxQuantity = Math.trunc(n)
      continue
    }
    if (!isTenantSettingKey(key)) continue
    merged[key] = parseTenantSettingValue(key, row.value as string | null)
  }

  if (
    legacyMaxQuantity != null &&
    !data?.some((row) => String(row.key) === "numeric_quantity_max_digits")
  ) {
    merged.numeric_quantity_max_digits = digitsFromMaxQuantity(legacyMaxQuantity)
  }

  return merged
}

export async function loadTenantSetting(
  supabase: SupabaseClient,
  companyId: string,
  key: TenantSettingKey,
): Promise<number> {
  const all = await loadTenantSettings(supabase, companyId, [key])
  return all[key]
}

export function getPollingIntervalMs(settings: {
  polling_interval_seconds: number
}): number {
  return settings.polling_interval_seconds * 1000
}
