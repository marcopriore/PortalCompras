import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import type { CostCenterOption } from "@/components/ui/cost-center-select"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export async function fetchCostCentersOptions(
  supabase: SupabaseClient,
  companyId: string,
  includeInactiveCodes: string[],
): Promise<CostCenterOption[]> {
  const { data } = await supabase
    .from("cost_centers")
    .select("id, code, description, active")
    .eq("company_id", companyId)
    .order("code", { ascending: true })

  const rows = (data ?? []) as {
    id: string
    code: string
    description: string
    active: boolean
  }[]
  const allow = new Set(
    includeInactiveCodes.map((c) => c.trim().toUpperCase()).filter(Boolean),
  )
  return rows
    .filter((r) => r.active || allow.has(r.code.toUpperCase()))
    .map((r) => ({
      id: r.id,
      code: r.code,
      description: r.description,
    }))
}

export function costCentersOptionsQueryOptions(
  companyId: string,
  includeInactiveCodes: string[],
  supabaseFactory: SupabaseClientFactory,
) {
  const inactiveKey = includeInactiveCodes.join("|")
  return queryOptions({
    queryKey: queryKeys.costCentersOptions(companyId, inactiveKey),
    queryFn: () =>
      fetchCostCentersOptions(supabaseFactory(), companyId, includeInactiveCodes),
    enabled: Boolean(companyId),
  })
}