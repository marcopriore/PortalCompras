import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"

export type SupplierQuotationCompanyEmbed = {
  name: string
  cnpj?: string | null
}

export type SupplierQuotationDetailRow = {
  id: string
  code: string
  description: string
  status: string
  company_id: string
  companies?: SupplierQuotationCompanyEmbed | SupplierQuotationCompanyEmbed[] | null
}

export type SupplierQuotationRoundRow = {
  id: string
  quotation_id: string
  company_id?: string | null
  round_number: number
  status: "active" | "closed" | string
  response_deadline: string | null
  created_at?: string | null
  closed_at?: string | null
}

export type SupplierQuotationItemRow = {
  id: string
  quotation_id: string
  company_id?: string | null
  material_code: string
  material_description: string
  long_description?: string | null
  unit_of_measure: string | null
  quantity: number | string
}

export type SupplierProposalItemRow = {
  id?: string
  proposal_id?: string
  quotation_item_id: string
  round_id?: string | null
  company_id?: string | null
  unit_price: number | string | null
  tax_percent: number | string | null
  delivery_days?: number | null
  item_status: string
  observations?: string | null
}

export type SupplierQuotationProposalRow = {
  id: string
  quotation_id: string
  supplier_id: string | null
  round_id: string | null
  company_id?: string | null
  status: string
  delivery_days: number | null
  payment_condition: string | null
  total_price: number | null
  validity_date: string | null
  observations: string | null
  proposal_items?: SupplierProposalItemRow[] | null
  updated_at?: string | null
}

export type SupplierPaymentOptionRow = {
  id: string
  code: string
  description: string
}

export type SupplierQuotationDetailDto = {
  quotation: SupplierQuotationDetailRow
  rounds: SupplierQuotationRoundRow[]
  quotationItems: SupplierQuotationItemRow[]
  activeRound: SupplierQuotationRoundRow | null
  previousRound: SupplierQuotationRoundRow | null
  supplierInfo: { name: string; cnpj: string | null } | null
  proposalsByRoundId: Record<string, SupplierQuotationProposalRow>
  paymentOptions: SupplierPaymentOptionRow[]
}

export async function fetchSupplierQuotationDetail(
  supabase: SupabaseClient,
  supplierId: string,
  quotationId: string,
): Promise<SupplierQuotationDetailDto> {
  const [supplierResult, quotationResult] = await Promise.all([
    supabase.from("suppliers").select("id, name, cnpj").eq("id", supplierId).single(),
    supabase
      .from("quotations")
      .select("id, code, description, status, company_id, companies(name, cnpj)")
      .eq("id", quotationId)
      .single(),
  ])

  if (quotationResult.error) {
    throw quotationResult.error
  }

  const qRow = quotationResult.data as SupplierQuotationDetailRow
  const supplierInfo = supplierResult.error
    ? null
    : {
        name: supplierResult.data?.name ?? "",
        cnpj: supplierResult.data?.cnpj ?? null,
      }

  const companyId = qRow.company_id

  const [roundsResult, itemsResult, paymentResult, allProposalsResult] =
    await Promise.all([
      supabase
        .from("quotation_rounds")
        .select(
          "id, quotation_id, company_id, round_number, status, response_deadline, created_at, closed_at",
        )
        .eq("quotation_id", quotationId)
        .order("round_number", { ascending: true }),
      supabase
        .from("quotation_items")
        .select(
          "id, quotation_id, company_id, material_code, material_description, long_description, unit_of_measure, quantity",
        )
        .eq("quotation_id", quotationId)
        .order("material_description", { ascending: true }),
      supabase
        .from("payment_conditions")
        .select("id, code, description")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("code", { ascending: true }),
      supabase
        .from("quotation_proposals")
        .select("*, proposal_items(*)")
        .eq("quotation_id", quotationId)
        .eq("supplier_id", supplierId),
    ])

  if (roundsResult.error) throw roundsResult.error
  if (itemsResult.error) throw itemsResult.error
  if (allProposalsResult.error) throw allProposalsResult.error

  const roundsLocal = (roundsResult.data ?? []) as SupplierQuotationRoundRow[]
  const active = roundsLocal.find((r) => r.status === "active") ?? null
  const previous =
    active != null
      ? (roundsLocal.find((r) => r.round_number === active.round_number - 1) ??
        null)
      : null

  const list = (allProposalsResult.data ?? []) as SupplierQuotationProposalRow[]
  const proposalsByRoundMap: Record<string, SupplierQuotationProposalRow> = {}
  for (const p of list) {
    if (p.round_id) proposalsByRoundMap[p.round_id] = p
  }

  return {
    quotation: qRow,
    rounds: roundsLocal,
    quotationItems: (itemsResult.data ?? []) as SupplierQuotationItemRow[],
    activeRound: active,
    previousRound: previous,
    supplierInfo,
    proposalsByRoundId: proposalsByRoundMap,
    paymentOptions: paymentResult.error
      ? []
      : ((paymentResult.data ?? []) as SupplierPaymentOptionRow[]),
  }
}

export type SupabaseClientFactory = () => SupabaseClient

export function supplierQuotationDetailQueryOptions(
  companyId: string,
  supplierId: string,
  quotationId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.supplierQuotationDetail(
      companyId,
      supplierId,
      quotationId,
    ),
    queryFn: () =>
      fetchSupplierQuotationDetail(
        supabaseFactory(),
        supplierId,
        quotationId,
      ),
    enabled: Boolean(companyId && supplierId && quotationId),
  })
}