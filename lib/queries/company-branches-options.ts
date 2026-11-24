import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import type { BranchOption } from "@/components/ui/branch-select"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export async function fetchCompanyBranchesOptions(
  supabase: SupabaseClient,
  companyId: string,
  includeInactiveCodes: string[],
): Promise<BranchOption[]> {
  const { data } = await supabase
    .from("company_branches")
    .select("code, name, active")
    .eq("company_id", companyId)
    .order("code", { ascending: true })

  const rows = (data ?? []) as {
    code: string
    name: string
    active: boolean
  }[]
  const allowInactive = new Set(
    includeInactiveCodes.filter(Boolean).map((c) => c.trim().toUpperCase()),
  )
  return rows
    .filter((r) => r.active || allowInactive.has(r.code.trim().toUpperCase()))
    .map((r) => ({ code: r.code, name: r.name }))
}

export function companyBranchesOptionsQueryOptions(
  companyId: string,
  includeInactiveCodes: string[],
  supabaseFactory: SupabaseClientFactory,
) {
  const inactiveKey = includeInactiveCodes.join("|")
  return queryOptions({
    queryKey: queryKeys.companyBranchesOptions(companyId, inactiveKey),
    queryFn: () =>
      fetchCompanyBranchesOptions(
        supabaseFactory(),
        companyId,
        includeInactiveCodes,
      ),
    enabled: Boolean(companyId),
  })
}