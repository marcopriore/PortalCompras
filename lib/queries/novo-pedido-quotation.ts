import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { CompanyBranchRow } from "@/lib/branches/branch-queries"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export type NovoPedidoQuotation = {
  id: string
  code: string
  description: string | null
  status: string
  created_by?: string | null
}

export type NovoPedidoProposalItem = {
  id: string
  proposal_id: string
  quotation_item_id: string
  unit_price: number
  tax_percent: number | null
  delivery_days: number | null
  item_status: "accepted" | "rejected"
  observations: string | null
}

export type NovoPedidoProposal = {
  id: string
  quotation_id: string
  supplier_id: string | null
  supplier_name: string
  supplier_cnpj: string | null
  payment_condition: string | null
  delivery_days: number | null
  status: "submitted" | "selected" | "rejected"
  observations: string | null
  proposal_items: NovoPedidoProposalItem[]
}

export type NovoPedidoQuotationItem = {
  id: string
  quotation_id: string
  material_code: string
  material_description: string
  quantity: number
  unit_of_measure: string | null
  site_code?: string | null
}

export type NovoPedidoLoadDto = {
  quotation: NovoPedidoQuotation | null
  proposal: NovoPedidoProposal | null
  quotationItems: NovoPedidoQuotationItem[]
  branchByCode: CompanyBranchRow[]
}

export async function fetchNovoPedidoQuotationLoad(
  supabase: SupabaseClient,
  companyId: string,
  quotationId: string,
): Promise<NovoPedidoLoadDto> {
  const [qRes, pRes, qiRes, branchesRes] = await Promise.all([
    supabase
      .from("quotations")
      .select("id, code, description, status, created_by")
      .eq("id", quotationId)
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("quotation_proposals")
      .select("*, proposal_items(*)")
      .eq("quotation_id", quotationId)
      .eq("status", "selected")
      .maybeSingle(),
    supabase.from("quotation_items").select("*").eq("quotation_id", quotationId),
    supabase
      .from("company_branches")
      .select("id, code, name, address, city, state, zip_code")
      .eq("company_id", companyId),
  ])

  return {
    quotation: (qRes.data as NovoPedidoQuotation | null) ?? null,
    proposal: (pRes.data as NovoPedidoProposal | null) ?? null,
    quotationItems: ((qiRes.data ?? []) as NovoPedidoQuotationItem[]) ?? [],
    branchByCode: ((branchesRes.data ?? []) as CompanyBranchRow[]) ?? [],
  }
}

export function novoPedidoQuotationQueryOptions(
  companyId: string,
  quotationId: string,
  supabaseFactory: SupabaseClientFactory,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: queryKeys.novoPedidoQuotation(companyId, quotationId),
    queryFn: () =>
      fetchNovoPedidoQuotationLoad(supabaseFactory(), companyId, quotationId),
    enabled: enabled && Boolean(companyId && quotationId),
  })
}