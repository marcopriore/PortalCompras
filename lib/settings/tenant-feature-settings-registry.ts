import type { TenantSettingGroup } from "@/lib/settings/tenant-settings-registry"

export type TenantFeatureBooleanKey =
  | "account_assignment_enabled"
  | "por_enabled"
  | "erp_integration_enabled"

export type TenantFeatureTextKey = "erp_vendor"

export type TenantFeatureKey = TenantFeatureBooleanKey | TenantFeatureTextKey

export type ErpVendor = "none" | "sap" | "other"

/** Chaves legadas (cutover) — lidas como fallback ao carregar. */
export const LEGACY_FEATURE_KEY_ALIASES: Record<string, TenantFeatureKey> = {
  cutover_account_assignment_enabled: "account_assignment_enabled",
  cutover_por_enabled: "por_enabled",
  cutover_erp_integration_enabled: "erp_integration_enabled",
  cutover_erp_vendor: "erp_vendor",
}

export type TenantFeatureBooleanDefinition = {
  key: TenantFeatureBooleanKey
  label: string
  description: string
  group: TenantSettingGroup
  defaultNewTenant: boolean
  defaultLegacyMissing: boolean
}

export type TenantFeatureTextDefinition = {
  key: TenantFeatureTextKey
  label: string
  description: string
  group: TenantSettingGroup
  defaultNewTenant: ErpVendor
  defaultLegacyMissing: ErpVendor
  options: { value: ErpVendor; label: string }[]
}

export const TENANT_FEATURE_BOOLEAN_REGISTRY: TenantFeatureBooleanDefinition[] =
  [
    {
      key: "account_assignment_enabled",
      label: "Classificação fiscal, coletores e rateio",
      description:
        "Classificação contábil, coletores de custo e rateio por linha (requisição e pedido). Desligado = sem validação na UI e campos omitidos no payload ERP.",
      group: "negocios",
      defaultNewTenant: false,
      defaultLegacyMissing: true,
    },
    {
      key: "por_enabled",
      label: "POR (fator de preço SAP)",
      description:
        "Campo POR nos itens do pedido para ajuste de casas decimais em integrações SAP.",
      group: "negocios",
      defaultNewTenant: false,
      defaultLegacyMissing: true,
    },
    {
      key: "erp_integration_enabled",
      label: "Integração outbound com ERP",
      description:
        "Envio de pedidos, requisições e contratos ao ERP externo (requer feature api_integrations).",
      group: "negocios",
      defaultNewTenant: false,
      defaultLegacyMissing: false,
    },
  ]

export const TENANT_FEATURE_TEXT_REGISTRY: TenantFeatureTextDefinition[] = [
  {
    key: "erp_vendor",
    label: "Tipo de ERP",
    description:
      "Perfil do ERP na implantação. Afeta campos opcionais do payload outbound (ex.: extensões SAP).",
    group: "negocios",
    defaultNewTenant: "none",
    defaultLegacyMissing: "none",
    options: [
      { value: "none", label: "Sem ERP / não integrado" },
      { value: "sap", label: "SAP" },
      { value: "other", label: "Outro ERP" },
    ],
  },
]

const BOOL_BY_KEY = new Map(
  TENANT_FEATURE_BOOLEAN_REGISTRY.map((d) => [d.key, d]),
)

export function isTenantFeatureBooleanKey(
  key: string,
): key is TenantFeatureBooleanKey {
  return BOOL_BY_KEY.has(key as TenantFeatureBooleanKey)
}

export function isTenantFeatureTextKey(key: string): key is TenantFeatureTextKey {
  return key === "erp_vendor"
}

export function isTenantFeatureKey(key: string): key is TenantFeatureKey {
  return isTenantFeatureBooleanKey(key) || isTenantFeatureTextKey(key)
}

export function isErpVendor(value: string): value is ErpVendor {
  return value === "none" || value === "sap" || value === "other"
}

export function normalizeFeatureSettingKey(key: string): TenantFeatureKey | null {
  if (isTenantFeatureKey(key)) return key
  return LEGACY_FEATURE_KEY_ALIASES[key] ?? null
}
