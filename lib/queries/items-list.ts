import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"

export type ItemListRow = {
  id: string
  company_id?: string
  code: string
  short_description: string
  long_description: string | null
  status: "active" | "inactive"
  unit_of_measure: string | null
  ncm: string | null
  commodity_group: string | null
  target_price: number | null
  last_purchase_price: number | null
  average_price: number | null
  created_at: string
  source?: string | null
  sync_at?: string | null
}

export async function fetchItemsList(
  supabase: SupabaseClient,
  companyId: string,
): Promise<ItemListRow[]> {
  const { data, error } = await supabase
    .from("items")
    .select(
      "id, company_id, code, short_description, long_description, status, unit_of_measure, ncm, commodity_group, target_price, last_purchase_price, average_price, source, sync_at, created_at",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return (data as ItemListRow[]) ?? []
}

export function itemsListQueryOptions(
  supabase: SupabaseClient,
  companyId: string,
) {
  return queryOptions({
    queryKey: queryKeys.itemsList(companyId),
    queryFn: () => fetchItemsList(supabase, companyId),
  })
}