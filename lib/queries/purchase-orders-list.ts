import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { enrichProfileNames } from "@/lib/queries/enrich-profile-names"
import { queryKeys } from "@/lib/queries/keys"

export type PurchaseOrderListStatus =
  | "draft"
  | "awaiting_approval"
  | "processing"
  | "sent"
  | "refused"
  | "error"
  | "integration_error"
  | "completed"
  | "cancelled"

export type PurchaseOrderItemRel = { id: string }

export type PurchaseOrderListRow = {
  id: string
  code: string
  supplier_name: string
  supplier_cnpj: string | null
  total_price: number | null
  delivery_days: number | null
  payment_condition: string | null
  quotation_code: string | null
  status: PurchaseOrderListStatus
  created_at: string
  updated_at: string | null
  created_by: string | null
  purchase_order_items: PurchaseOrderItemRel[]
  responsible_name: string
}

type PurchaseOrderListQueryRow = Omit<PurchaseOrderListRow, "responsible_name">

const PURCHASE_ORDERS_LIST_SELECT =
  "id, code, supplier_name, supplier_cnpj, total_price, delivery_days, payment_condition, quotation_code, status, created_at, updated_at, created_by, purchase_order_items(id)" as const

export async function fetchPurchaseOrdersList(
  supabase: SupabaseClient,
  companyId: string,
  scope: "all" | string,
): Promise<PurchaseOrderListRow[]> {
  let query = supabase
    .from("purchase_orders")
    .select(PURCHASE_ORDERS_LIST_SELECT)
    .eq("company_id", companyId)

  if (scope !== "all") {
    query = query.eq("created_by", scope)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  const rows = (data ?? []) as PurchaseOrderListQueryRow[]
  const ownerIds = [
    ...new Set(
      rows.map((o) => o.created_by).filter((id): id is string => Boolean(id)),
    ),
  ]
  const nameById = await enrichProfileNames(supabase, ownerIds)

  return rows.map((o) => ({
    ...o,
    responsible_name: o.created_by ? nameById.get(o.created_by) ?? "" : "",
  }))
}

export function purchaseOrdersListQueryOptions(
  supabase: SupabaseClient,
  companyId: string,
  scope: "all" | string,
) {
  return queryOptions({
    queryKey: queryKeys.purchaseOrdersList(companyId, scope),
    queryFn: () => fetchPurchaseOrdersList(supabase, companyId, scope),
  })
}