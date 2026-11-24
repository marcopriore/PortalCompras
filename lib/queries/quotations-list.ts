import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { enrichProfileNames } from "@/lib/queries/enrich-profile-names"
import { queryKeys } from "@/lib/queries/keys"

export type QuotationSupplierRel = { supplier_name: string | null }

export type QuotationItemRel = {
  material_code: string | null
  material_description: string | null
}

export type QuotationStatus =
  | "draft"
  | "waiting"
  | "analysis"
  | "completed"
  | "cancelled"

export type QuotationListRow = {
  id: string
  code: string
  description: string
  status: QuotationStatus
  category: string | null
  payment_condition: string | null
  response_deadline: string | null
  created_at: string
  created_by: string | null
  company_id: string
  quotation_suppliers?: QuotationSupplierRel[] | null
  quotation_items?: QuotationItemRel[] | null
  responsible_name: string
}

type QuotationListQueryRow = Omit<QuotationListRow, "responsible_name">

export async function fetchQuotationsList(
  supabase: SupabaseClient,
  companyId: string,
  scope: "all" | string,
): Promise<QuotationListRow[]> {
  let query = supabase
    .from("quotations")
    .select(
      "*, quotation_suppliers(supplier_name), quotation_items(material_code, material_description)",
    )
    .eq("company_id", companyId)

  if (scope !== "all") {
    query = query.eq("created_by", scope)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  const rows = (data ?? []) as QuotationListQueryRow[]
  const ownerIds = [
    ...new Set(
      rows.map((q) => q.created_by).filter((id): id is string => Boolean(id)),
    ),
  ]
  const nameById = await enrichProfileNames(supabase, ownerIds)

  return rows.map((q) => ({
    ...q,
    responsible_name: q.created_by ? nameById.get(q.created_by) ?? "" : "",
  }))
}

export function quotationsListQueryOptions(
  supabase: SupabaseClient,
  companyId: string,
  scope: "all" | string,
) {
  return queryOptions({
    queryKey: queryKeys.quotationsList(companyId, scope),
    queryFn: () => fetchQuotationsList(supabase, companyId, scope),
  })
}