import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export type ContractFormSupplierRow = {
  id: string
  name: string
  code: string
}

export async function fetchContractFormSuppliers(
  supabase: SupabaseClient,
  companyId: string,
): Promise<ContractFormSupplierRow[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, code")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("name")

  if (error) {
    throw error
  }

  return (data ?? []) as ContractFormSupplierRow[]
}

export function contractFormSuppliersQueryOptions(
  companyId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.contractFormSuppliers(companyId),
    queryFn: () => fetchContractFormSuppliers(supabaseFactory(), companyId),
    enabled: Boolean(companyId),
  })
}