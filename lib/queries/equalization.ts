import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { ensureInitialQuotationRound } from "@/lib/quotations/round-lifecycle"
import { findOwnRequisitionCodes } from "@/lib/requisitions/own-requisition-guard"
import { queryKeys } from "@/lib/queries/keys"

/** Pedidos nestes status não bloqueiam o item na equalização para novo pedido. */
const PO_STATUSES_RELEASING_QUOTATION_ITEM = new Set(["cancelled", "refused"])

export type EqualizationRound = {
  id: string
  company_id?: string
  round_number: number
  status: "active" | "closed"
  created_at: string
  closed_at: string | null
  response_deadline: string | null
}

export type EqualizationQuotation = {
  id: string
  code: string
  description: string
  status: string
  category?: string | null
  payment_condition?: string | null
  response_deadline?: string | null
  created_at?: string | null
  created_by?: string | null
}

export type EqualizationQuotationItem = {
  id: string
  material_code: string
  material_description: string
  long_description?: string | null
  quantity: number
  unit_of_measure: string
  target_price?: number | null
  last_purchase_price?: number | null
  average_price?: number | null
  source_requisition_code?: string | null
  site_code?: string | null
}

export type EqualizationProposalItem = {
  id: string
  proposal_id: string
  quotation_item_id: string
  round_id?: string | null
  unit_price: number
  tax_percent: number | null
  delivery_days?: number | null
  item_status: "accepted" | "rejected"
  observations: string | null
}

export type EqualizationProposal = {
  id: string
  round_id?: string | null
  supplier_id?: string | null
  supplier_name: string
  supplier_cnpj: string | null
  total_price: number | null
  delivery_days: number | null
  payment_condition: string | null
  validity_date: string | null
  observations: string | null
  status: "invited" | "submitted" | "selected" | "rejected"
  proposal_items: EqualizationProposalItem[]
}

export type EqualizationQuotationSupplier = {
  supplier_id: string
  position: number | null
  suppliers?:
    | { name: string; cnpj: string | null }
    | { name: string; cnpj: string | null }[]
    | null
}

export type EqualizationOrderedItemInfo = {
  orderId: string
  orderCode: string
  proposalId: string
  roundId: string | null
  roundNumber: number | null
}

export type EqualizationStructureSnapshot = {
  items: number
  suppliers: number
}

export type EqualizationBundleDto = {
  rounds: EqualizationRound[]
  quotation: EqualizationQuotation | null
  quotationItems: EqualizationQuotationItem[]
  quotationSuppliers: EqualizationQuotationSupplier[]
  allProposalsCatalog: EqualizationProposal[]
  orderedItems: Record<string, EqualizationOrderedItemInfo>
  structureSnapshot: EqualizationStructureSnapshot
}

function pickNestedRoundNumber(
  quotation_rounds:
    | { round_number: number }
    | { round_number: number }[]
    | null
    | undefined,
): number | null {
  if (!quotation_rounds) return null
  const o = Array.isArray(quotation_rounds) ? quotation_rounds[0] : quotation_rounds
  return o?.round_number ?? null
}

function mapAllProposalsCatalog(
  raw: EqualizationProposal[] | null | undefined,
): EqualizationProposal[] {
  return (raw ?? []).map((p) => ({
    ...p,
    proposal_items: (p.proposal_items ?? []).filter(
      (pi) =>
        p.round_id != null && (pi.round_id === p.round_id || pi.round_id == null),
    ),
  }))
}

function normalizeQuotationItems(
  rows: EqualizationQuotationItem[] | null | undefined,
): EqualizationQuotationItem[] {
  return (rows ?? []).map((i) => ({
    ...i,
    target_price: i.target_price != null ? Number(i.target_price) : null,
    last_purchase_price:
      i.last_purchase_price != null ? Number(i.last_purchase_price) : null,
    average_price: i.average_price != null ? Number(i.average_price) : null,
  }))
}

export async function fetchEqualizationBundle(
  supabase: SupabaseClient,
  companyId: string,
  quotationId: string,
): Promise<EqualizationBundleDto> {
  const { data: roundsData, error: roundsError } = await supabase
    .from("quotation_rounds")
    .select(
      "id, quotation_id, company_id, round_number, status, created_at, closed_at, response_deadline",
    )
    .eq("quotation_id", quotationId)
    .order("round_number", { ascending: true })

  if (roundsError) throw roundsError

  let roundsList = ((roundsData ?? []) as EqualizationRound[]).map((r) => ({
    ...r,
    response_deadline: r.response_deadline ?? null,
  }))

  if (roundsList.length === 0) {
    const { data: qBoot } = await supabase
      .from("quotations")
      .select("status, response_deadline")
      .eq("id", quotationId)
      .eq("company_id", companyId)
      .maybeSingle()

    if (
      qBoot &&
      (qBoot.status === "waiting" || qBoot.status === "analysis")
    ) {
      const boot = await ensureInitialQuotationRound(supabase, {
        companyId,
        quotationId,
        responseDeadlineYmd: qBoot.response_deadline ?? null,
      })
      if (boot.ok && boot.created) {
        const { data: roundsData2, error: roundsError2 } = await supabase
          .from("quotation_rounds")
          .select(
            "id, quotation_id, company_id, round_number, status, created_at, closed_at, response_deadline",
          )
          .eq("quotation_id", quotationId)
          .order("round_number", { ascending: true })
        if (roundsError2) throw roundsError2
        roundsList = ((roundsData2 ?? []) as EqualizationRound[]).map((r) => ({
          ...r,
          response_deadline: r.response_deadline ?? null,
        }))
      }
    }
  }

  const [qRes, itemsRes, qsRes, allProposalsRawRes] = await Promise.all([
    supabase
      .from("quotations")
      .select(
        "id, code, description, status, category, payment_condition, response_deadline, created_at, created_by",
      )
      .eq("id", quotationId)
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("quotation_items")
      .select(
        "id, quotation_id, company_id, material_code, material_description, long_description, unit_of_measure, quantity, target_price, last_purchase_price, average_price, source_requisition_code, site_code, created_at",
      )
      .eq("quotation_id", quotationId)
      .order("material_description", { ascending: true }),
    supabase
      .from("quotation_suppliers")
      .select("*, suppliers(name, cnpj)")
      .eq("quotation_id", quotationId)
      .order("position", { ascending: true, nullsFirst: false }),
    supabase
      .from("quotation_proposals")
      .select("*, proposal_items(*)")
      .eq("quotation_id", quotationId),
  ])

  if (qRes.error) throw qRes.error
  if (itemsRes.error) throw itemsRes.error
  if (qsRes.error) throw qsRes.error
  if (allProposalsRawRes.error) throw allProposalsRawRes.error

  const quotation = (qRes.data as EqualizationQuotation | null) ?? null
  const quotationItems = normalizeQuotationItems(
    (itemsRes.data as EqualizationQuotationItem[] | null) ?? [],
  )
  const quotationSuppliers = (qsRes.data ?? []) as EqualizationQuotationSupplier[]
  const allProposalsCatalog = mapAllProposalsCatalog(
    (allProposalsRawRes.data ?? []) as EqualizationProposal[],
  )

  const orderedItems: Record<string, EqualizationOrderedItemInfo> = {}
  const quotationItemIds = quotationItems.map((i) => i.id)
  if (quotationItemIds.length > 0) {
    const { data: poItemsData } = await supabase
      .from("purchase_order_items")
      .select(
        "quotation_item_id, purchase_order_id, round_id, purchase_orders(code, proposal_id, status), quotation_rounds(round_number)",
      )
      .in("quotation_item_id", quotationItemIds)

    ;(
      (poItemsData ?? []) as Array<{
        quotation_item_id: string
        purchase_order_id: string
        round_id: string | null
        purchase_orders:
          | { code: string; proposal_id: string | null; status?: string }
          | { code: string; proposal_id: string | null; status?: string }[]
          | null
        quotation_rounds:
          | { round_number: number }
          | { round_number: number }[]
          | null
      }>
    ).forEach((row) => {
      const po = Array.isArray(row.purchase_orders)
        ? row.purchase_orders[0]
        : row.purchase_orders
      const poStatus = po?.status ?? ""
      if (PO_STATUSES_RELEASING_QUOTATION_ITEM.has(poStatus)) return
      const orderCode = po?.code ?? "—"
      const proposalId = po?.proposal_id ?? ""
      const roundNumber = pickNestedRoundNumber(row.quotation_rounds)
      if (!orderedItems[row.quotation_item_id]) {
        orderedItems[row.quotation_item_id] = {
          orderId: row.purchase_order_id,
          orderCode,
          proposalId,
          roundId: row.round_id ?? null,
          roundNumber,
        }
      }
    })
  }

  return {
    rounds: roundsList,
    quotation,
    quotationItems,
    quotationSuppliers,
    allProposalsCatalog,
    orderedItems,
    structureSnapshot: {
      items: quotationItems.length,
      suppliers: quotationSuppliers.length,
    },
  }
}

export type SupabaseClientFactory = () => SupabaseClient

export function equalizationQueryOptions(
  companyId: string,
  quotationId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.equalization(companyId, quotationId),
    queryFn: () =>
      fetchEqualizationBundle(supabaseFactory(), companyId, quotationId),
    enabled: Boolean(companyId && quotationId),
  })
}

export function ownRequisitionCodesQueryOptions(
  companyId: string,
  userId: string,
  requisitionCodes: string[],
  supabaseFactory: SupabaseClientFactory,
) {
  const codesKey = [...requisitionCodes].sort().join("\0")
  return queryOptions({
    queryKey: queryKeys.ownRequisitionCodes(companyId, userId, codesKey),
    queryFn: () =>
      findOwnRequisitionCodes(
        supabaseFactory(),
        companyId,
        userId,
        requisitionCodes,
      ),
    enabled: Boolean(companyId && userId && requisitionCodes.length > 0),
  })
}