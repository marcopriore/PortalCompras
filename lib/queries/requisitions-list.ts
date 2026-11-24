import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { RequisitionStatus } from "@/lib/requisitions/status"
import { queryKeys } from "@/lib/queries/keys"

export type RequisitionPriority = "normal" | "urgent" | "critical"

export type RequisitionItemRel = { id: string }

export type RequisitionListRow = {
  id: string
  code: string
  title: string
  requester_id: string | null
  requester_name: string | null
  cost_center: string | null
  needed_by: string | null
  priority: RequisitionPriority
  status: RequisitionStatus
  created_at: string
  company_id: string
  quotation_id: string | null
  requisition_items: RequisitionItemRel[]
}

export async function fetchRequisitionsList(
  supabase: SupabaseClient,
  companyId: string,
  scope: "all" | string,
): Promise<RequisitionListRow[]> {
  let query = supabase
    .from("requisitions")
    .select("*, requisition_items(id)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })

  if (scope !== "all") {
    query = query.eq("requester_id", scope)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []) as RequisitionListRow[]
}

export function requisitionsListQueryOptions(
  supabase: SupabaseClient,
  companyId: string,
  scope: "all" | string,
) {
  return queryOptions({
    queryKey: queryKeys.requisitionsList(companyId, scope),
    queryFn: () => fetchRequisitionsList(supabase, companyId, scope),
  })
}

export function solicitanteRequisitionsListQueryOptions(
  supabase: SupabaseClient,
  companyId: string,
  scope: "all" | string,
) {
  return queryOptions({
    queryKey: queryKeys.solicitanteRequisitionsList(companyId, scope),
    queryFn: () => fetchRequisitionsList(supabase, companyId, scope),
    enabled: Boolean(companyId && scope),
  })
}