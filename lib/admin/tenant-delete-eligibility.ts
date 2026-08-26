import type { SupabaseClient } from "@supabase/supabase-js"

/** Tabelas de negócio que impedem exclusão definitiva do tenant. */
export const TENANT_BUSINESS_TABLES = [
  { key: "requisitions", label: "Requisições" },
  { key: "quotations", label: "Cotações" },
  { key: "purchase_orders", label: "Pedidos" },
  { key: "contracts", label: "Contratos" },
  { key: "items", label: "Itens" },
  { key: "suppliers", label: "Fornecedores" },
  { key: "api_keys", label: "API keys" },
  { key: "integration_delivery_logs", label: "Logs de integração" },
] as const

export type TenantBusinessTableKey =
  (typeof TENANT_BUSINESS_TABLES)[number]["key"]

export type TenantDeleteBlockers = Partial<
  Record<TenantBusinessTableKey, number>
>

export type TenantDeleteEligibility = {
  eligible: boolean
  blockers: TenantDeleteBlockers
  profileCount: number
  companyName: string | null
}

async function countRows(
  supabase: SupabaseClient,
  table: string,
  companyId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)

  if (error) {
    // Tabela ausente / sem permissão: tratar como bloqueio conservador
    console.error(`[tenant-delete] count ${table}:`, error.message)
    return -1
  }

  return count ?? 0
}

export async function getTenantDeleteEligibility(
  supabase: SupabaseClient,
  companyId: string,
): Promise<TenantDeleteEligibility> {
  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle()

  const blockers: TenantDeleteBlockers = {}

  await Promise.all(
    TENANT_BUSINESS_TABLES.map(async (t) => {
      const n = await countRows(supabase, t.key, companyId)
      if (n !== 0) {
        blockers[t.key] = n < 0 ? 1 : n
      }
    }),
  )

  const { count: profileCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)

  return {
    eligible: Object.keys(blockers).length === 0,
    blockers,
    profileCount: profileCount ?? 0,
    companyName: company?.name != null ? String(company.name) : null,
  }
}

export function formatTenantDeleteBlockers(
  blockers: TenantDeleteBlockers,
): string {
  const parts = TENANT_BUSINESS_TABLES.filter((t) => (blockers[t.key] ?? 0) > 0).map(
    (t) => {
      const n = blockers[t.key] ?? 0
      return `${t.label}: ${n}`
    },
  )
  if (parts.length === 0) return ""
  return `Tenant possui dados de negócio (${parts.join(", ")}). Use inativação.`
}
