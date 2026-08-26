import type { SupabaseClient } from "@supabase/supabase-js"
import type { FeatureKey } from "@/lib/hooks/usePermissions"

/** Chaves de módulo alinhadas a usePermissions / admin tenants. */
export const TENANT_FEATURE_KEYS: FeatureKey[] = [
  "quotations",
  "equalization",
  "orders",
  "requisitions",
  "suppliers",
  "items",
  "reports",
  "users",
  "logs",
  "settings",
  "approval_requisition",
  "approval_order",
  "ai_analytics",
  "ai_negotiation",
  "contracts",
  "contract_balance",
  "api_integrations",
  "purchase_catalog",
]

/**
 * Liga todos os módulos no tenant novo.
 * Sem isso, a UI do admin pode parecer "ligada" (default visual) enquanto
 * usePermissions trata ausência de linha como desligada — escondendo Contratos/Catálogo.
 */
export async function seedDefaultTenantFeatures(
  supabase: SupabaseClient,
  companyId: string,
  enabled = true,
): Promise<void> {
  const rows = TENANT_FEATURE_KEYS.map((feature_key) => ({
    company_id: companyId,
    feature_key,
    enabled,
  }))

  const { error } = await supabase
    .from("tenant_features")
    .upsert(rows, { onConflict: "company_id,feature_key" })

  if (error) throw error
}
