import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isErpVendor,
  isTenantFeatureBooleanKey,
  LEGACY_FEATURE_KEY_ALIASES,
  normalizeFeatureSettingKey,
  TENANT_FEATURE_BOOLEAN_REGISTRY,
  TENANT_FEATURE_TEXT_REGISTRY,
  type ErpVendor,
  type TenantFeatureBooleanKey,
  type TenantFeatureKey,
} from "@/lib/settings/tenant-feature-settings-registry"

export type TenantFeatureConfig = {
  accountAssignmentEnabled: boolean
  porEnabled: boolean
  erpIntegrationEnabled: boolean
  erpVendor: ErpVendor
}

type RawSettings = Partial<Record<string, string>>

function boolFromStorage(
  key: TenantFeatureBooleanKey,
  raw: string | undefined,
  legacy: boolean,
): boolean {
  if (raw == null || String(raw).trim() === "") return legacy
  const v = String(raw).trim().toLowerCase()
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true
  if (v === "0" || v === "false" || v === "no" || v === "off") return false
  const def = TENANT_FEATURE_BOOLEAN_REGISTRY.find((d) => d.key === key)
  return def?.defaultLegacyMissing ?? legacy
}

function erpVendorFromStorage(
  raw: string | undefined,
  legacy: ErpVendor,
): ErpVendor {
  if (raw == null || String(raw).trim() === "") return legacy
  const v = String(raw).trim().toLowerCase()
  return isErpVendor(v) ? v : legacy
}

function normalizeRawSettings(raw: RawSettings): RawSettings {
  const out: RawSettings = { ...raw }
  for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_FEATURE_KEY_ALIASES)) {
    if (out[legacyKey] != null && out[canonicalKey] == null) {
      out[canonicalKey] = out[legacyKey]
    }
  }
  return out
}

export function parseTenantFeatureConfig(raw: RawSettings): TenantFeatureConfig {
  const normalized = normalizeRawSettings(raw)

  const bool = (key: TenantFeatureBooleanKey) => {
    const def = TENANT_FEATURE_BOOLEAN_REGISTRY.find((d) => d.key === key)!
    return boolFromStorage(key, normalized[key], def.defaultLegacyMissing)
  }

  const erpDef = TENANT_FEATURE_TEXT_REGISTRY[0]

  return {
    accountAssignmentEnabled: bool("account_assignment_enabled"),
    porEnabled: bool("por_enabled"),
    erpIntegrationEnabled: bool("erp_integration_enabled"),
    erpVendor: erpVendorFromStorage(
      normalized.erp_vendor,
      erpDef.defaultLegacyMissing,
    ),
  }
}

/** @deprecated Use parseTenantFeatureConfig */
export const parseImplantationConfig = parseTenantFeatureConfig

/** @deprecated Use TenantFeatureConfig */
export type ImplantationConfig = TenantFeatureConfig

export function serializeTenantFeatureBoolean(value: boolean): string {
  return value ? "1" : "0"
}

export function buildDefaultTenantFeatureSettingsForNewTenant(): Record<
  TenantFeatureKey,
  string
> {
  const out = {} as Record<TenantFeatureKey, string>
  for (const def of TENANT_FEATURE_BOOLEAN_REGISTRY) {
    out[def.key] = serializeTenantFeatureBoolean(def.defaultNewTenant)
  }
  for (const def of TENANT_FEATURE_TEXT_REGISTRY) {
    out[def.key] = def.defaultNewTenant
  }
  return out
}

/** @deprecated */
export const buildDefaultImplantationSettingsForNewTenant =
  buildDefaultTenantFeatureSettingsForNewTenant

export async function seedDefaultTenantFeatureSettings(
  supabase: SupabaseClient,
  companyId: string,
): Promise<void> {
  const defaults = buildDefaultTenantFeatureSettingsForNewTenant()
  const rows = Object.entries(defaults).map(([key, value]) => ({
    company_id: companyId,
    key,
    value,
  }))

  const { error } = await supabase
    .from("company_settings")
    .upsert(rows, { onConflict: "company_id,key" })

  if (error) throw error
}

/** @deprecated */
export const seedDefaultImplantationSettings = seedDefaultTenantFeatureSettings

export async function loadTenantFeatureSettingsRaw(
  supabase: SupabaseClient,
  companyId: string,
): Promise<RawSettings> {
  const keys = [
    ...TENANT_FEATURE_BOOLEAN_REGISTRY.map((d) => d.key),
    ...TENANT_FEATURE_TEXT_REGISTRY.map((d) => d.key),
    ...Object.keys(LEGACY_FEATURE_KEY_ALIASES),
  ]

  const { data, error } = await supabase
    .from("company_settings")
    .select("key, value")
    .eq("company_id", companyId)
    .in("key", keys)

  if (error) {
    console.error("loadTenantFeatureSettingsRaw:", error)
    return {}
  }

  const out: RawSettings = {}
  for (const row of data ?? []) {
    out[String(row.key)] = String(row.value ?? "")
  }
  return out
}

export async function loadTenantFeatureConfig(
  supabase: SupabaseClient,
  companyId: string,
): Promise<TenantFeatureConfig> {
  const raw = await loadTenantFeatureSettingsRaw(supabase, companyId)
  return parseTenantFeatureConfig(raw)
}

/** @deprecated */
export const loadImplantationConfig = loadTenantFeatureConfig

export function validateTenantFeaturePatch(body: {
  booleans?: Record<string, unknown>
  erpVendor?: unknown
}):
  | { ok: true; rows: { key: TenantFeatureKey; value: string }[] }
  | { ok: false; error: string } {
  const rows: { key: TenantFeatureKey; value: string }[] = []

  if (body.booleans && typeof body.booleans === "object") {
    for (const [key, value] of Object.entries(body.booleans)) {
      const canonical = normalizeFeatureSettingKey(key)
      if (!canonical || !isTenantFeatureBooleanKey(canonical)) {
        return { ok: false, error: `Configuração desconhecida: ${key}` }
      }
      if (typeof value !== "boolean") {
        return { ok: false, error: `Valor inválido para ${key}` }
      }
      rows.push({
        key: canonical,
        value: serializeTenantFeatureBoolean(value),
      })
    }
  }

  if (body.erpVendor !== undefined) {
    if (typeof body.erpVendor !== "string" || !isErpVendor(body.erpVendor)) {
      return { ok: false, error: "Tipo de ERP inválido." }
    }
    rows.push({ key: "erp_vendor", value: body.erpVendor })
  }

  if (rows.length === 0) {
    return { ok: false, error: "Nenhuma configuração informada." }
  }

  return { ok: true, rows }
}

/** @deprecated */
export const validateImplantationPatch = validateTenantFeaturePatch
