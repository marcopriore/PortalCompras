import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"
import {
  mapOrderRowsToActivityItems,
  mapProposalRowsToActivityItems,
  mergeActivityByUpdatedAt,
  type ActivityItem,
  type OrderActivityRow,
  type ProposalActivityRow,
} from "@/lib/utils/activity-helpers"

export async function fetchSupplierActivities(
  supabase: SupabaseClient,
  supplierId: string,
  limit: number,
): Promise<ActivityItem[]> {
  const [proposalsRes, ordersRes] = await Promise.all([
    supabase
      .from("quotation_proposals")
      .select("status, updated_at, quotation_id, quotations!inner(code)")
      .eq("supplier_id", supplierId)
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("purchase_orders")
      .select(
        "id, code, status, updated_at, accepted_at, estimated_delivery_date, cancellation_reason",
      )
      .eq("supplier_id", supplierId)
      .neq("status", "draft")
      .neq("status", "awaiting_approval")
      .order("updated_at", { ascending: false })
      .limit(limit),
  ])

  if (proposalsRes.error) throw proposalsRes.error
  if (ordersRes.error) throw ordersRes.error

  const mappedProposals = mapProposalRowsToActivityItems(
    (proposalsRes.data as ProposalActivityRow[]) ?? [],
  )
  const mappedOrders = mapOrderRowsToActivityItems(
    (ordersRes.data as OrderActivityRow[]) ?? [],
  )
  return mergeActivityByUpdatedAt(mappedProposals, mappedOrders)
}

export type SupabaseClientFactory = () => SupabaseClient

export function supplierActivitiesQueryOptions(
  companyId: string,
  supplierId: string,
  supabaseFactory: SupabaseClientFactory,
  limit = 200,
) {
  return queryOptions({
    queryKey: queryKeys.supplierActivities(companyId, supplierId),
    queryFn: () =>
      fetchSupplierActivities(supabaseFactory(), supplierId, limit),
    enabled: Boolean(companyId && supplierId),
  })
}

export function supplierDashboardActivityQueryOptions(
  companyId: string,
  supplierId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.supplierDashboardActivity(companyId, supplierId),
    queryFn: async () => {
      const items = await fetchSupplierActivities(
        supabaseFactory(),
        supplierId,
        8,
      )
      return items.slice(0, 8)
    },
    enabled: Boolean(companyId && supplierId),
  })
}