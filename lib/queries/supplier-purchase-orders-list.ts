import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"

type CompanyEmbed = { name: string } | { name: string }[] | null

export type SupplierPurchaseOrderListRow = {
  id: string
  code: string
  quotation_code: string | null
  supplier_name: string
  status: string
  total_price: number | null
  payment_condition: string | null
  estimated_delivery_date: string | null
  accepted_at: string | null
  created_at: string
  accepted_by_supplier: boolean | null
  company_id: string
  companies: CompanyEmbed
}

const SUPPLIER_PO_LIST_SELECT = `
  id, code, quotation_code, supplier_name, status,
  total_price, payment_condition, estimated_delivery_date,
  accepted_at, created_at, accepted_by_supplier,
  company_id, companies(name)
` as const

export async function fetchSupplierPurchaseOrdersList(
  supabase: SupabaseClient,
  supplierId: string,
): Promise<SupplierPurchaseOrderListRow[]> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(SUPPLIER_PO_LIST_SELECT)
    .eq("supplier_id", supplierId)
    .neq("status", "draft")
    .neq("status", "awaiting_approval")
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data as SupplierPurchaseOrderListRow[]) ?? []
}

export type SupabaseClientFactory = () => SupabaseClient

export function supplierPurchaseOrdersListQueryOptions(
  companyId: string,
  supplierId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.supplierPurchaseOrdersList(companyId, supplierId),
    queryFn: () => fetchSupplierPurchaseOrdersList(supabaseFactory(), supplierId),
    enabled: Boolean(companyId && supplierId),
  })
}