import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { formatResponsibleName } from "@/lib/quotations/ownership"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export type QuotationDetailStatus =
  | "draft"
  | "waiting"
  | "analysis"
  | "completed"
  | "cancelled"
  | "rejected"

export type QuotationDetailQuotation = {
  id: string
  code: string
  description: string
  status: QuotationDetailStatus
  category: string | null
  payment_condition: string | null
  response_deadline: string | null
  created_at: string
  created_by: string | null
}

export type QuotationDetailItem = {
  id: string
  material_code: string
  material_description: string
  long_description?: string | null
  unit_of_measure: string | null
  quantity: number
  source_requisition_code?: string | null
}

export type QuotationDetailSupplier = {
  id: string
  supplier_name: string
  supplier_cnpj: string | null
}

export type QuotationDetailDto = {
  quotation: QuotationDetailQuotation
  responsibleName: string
  items: QuotationDetailItem[]
  suppliers: QuotationDetailSupplier[]
  requisitionIdByCode: Record<string, string>
}

export async function fetchQuotationDetail(
  supabase: SupabaseClient,
  companyId: string,
  id: string,
): Promise<QuotationDetailDto | null> {
  const { data: quotationData, error: quotationError } = await supabase
    .from("quotations")
    .select(
      "id, code, description, status, category, payment_condition, response_deadline, created_at, created_by",
    )
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle()

  if (quotationError || !quotationData) {
    return null
  }

  const q = quotationData as QuotationDetailQuotation

  let responsibleName = "—"
  if (q.created_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", q.created_by)
      .maybeSingle()
    responsibleName = formatResponsibleName(
      (profile as { full_name?: string | null } | null)?.full_name,
    )
  }

  const [{ data: itemsData }, { data: suppliersData }] = await Promise.all([
    supabase
      .from("quotation_items")
      .select(
        "id, material_code, material_description, long_description, unit_of_measure, quantity, source_requisition_code",
      )
      .eq("quotation_id", id),
    supabase
      .from("quotation_suppliers")
      .select("id, supplier_name, supplier_cnpj")
      .eq("quotation_id", id),
  ])

  const items = (itemsData as QuotationDetailItem[]) ?? []
  const suppliers = (suppliersData as QuotationDetailSupplier[]) ?? []

  const reqCodes = [
    ...new Set(
      items
        .map((item) => item.source_requisition_code?.trim())
        .filter((code): code is string => Boolean(code)),
    ),
  ]

  let requisitionIdByCode: Record<string, string> = {}
  if (reqCodes.length > 0) {
    const { data: reqs } = await supabase
      .from("requisitions")
      .select("id, code")
      .eq("company_id", companyId)
      .in("code", reqCodes)
    const map: Record<string, string> = {}
    ;((reqs ?? []) as { id: string; code: string }[]).forEach((req) => {
      if (req.code) map[req.code] = req.id
    })
    requisitionIdByCode = map
  }

  return {
    quotation: q,
    responsibleName,
    items,
    suppliers,
    requisitionIdByCode,
  }
}

export function quotationDetailQueryOptions(
  companyId: string,
  id: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.quotationDetail(companyId, id),
    queryFn: () => fetchQuotationDetail(supabaseFactory(), companyId, id),
    enabled: Boolean(companyId && id),
  })
}