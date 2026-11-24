import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"

export type SupplierStatus = "active" | "inactive"

export type SupplierListRow = {
  id: string
  code: string
  name: string
  cnpj: string | null
  email: string | null
  phone: string | null
  category: string | null
  city: string | null
  state: string | null
  status: SupplierStatus
  created_at: string
}

export type SuppliersListResult = {
  suppliers: SupplierListRow[]
  orderCounts: Record<string, number>
}

export async function fetchSuppliersList(
  supabase: SupabaseClient,
  companyId: string,
): Promise<SuppliersListResult> {
  const { data, error } = await supabase
    .from("suppliers")
    .select(
      "id, code, name, cnpj, email, phone, category, city, state, status, created_at",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  const list = (data as SupplierListRow[]) ?? []
  const supplierIds = list.map((s) => s.id)
  let orderCountMap: Record<string, number> = {}

  if (supplierIds.length > 0) {
    const { data: orderCountsData, error: ordersError } = await supabase
      .from("purchase_orders")
      .select("supplier_id")
      .eq("company_id", companyId)
      .in("supplier_id", supplierIds)

    if (ordersError) {
      throw ordersError
    }

    orderCountMap = (orderCountsData ?? []).reduce(
      (acc, o: { supplier_id: string | null }) => {
        if (o.supplier_id) {
          acc[o.supplier_id] = (acc[o.supplier_id] ?? 0) + 1
        }
        return acc
      },
      {} as Record<string, number>,
    )
  }

  return { suppliers: list, orderCounts: orderCountMap }
}

export function suppliersListQueryOptions(
  supabase: SupabaseClient,
  companyId: string,
) {
  return queryOptions({
    queryKey: queryKeys.suppliersList(companyId),
    queryFn: () => fetchSuppliersList(supabase, companyId),
  })
}