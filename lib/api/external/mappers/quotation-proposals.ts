export type QuotationItemContext = {
  id: string
  material_code: string | null
  material_description: string
  long_description: string | null
  unit_of_measure: string | null
  quantity: number
  target_price: number | null
  last_purchase_price: number | null
  average_price: number | null
}

export type ProposalItemApi = {
  quotation_item_id: string
  material_code: string | null
  material_description: string
  long_description: string | null
  unit_of_measure: string | null
  quantity: number
  unit_price: number | null
  tax_percent: number | null
  delivery_days: number | null
  item_status: string
  observations: string | null
  line_total: number | null
}

export type ProposalSupplierApi = {
  id: string
  code: string | null
  name: string | null
  cnpj: string | null
}

export type ProposalApi = {
  id: string
  status: string
  submitted_at: string | null
  payment_condition: string | null
  delivery_days: number | null
  total_price: number | null
  validity_date: string | null
  observations: string | null
  supplier: ProposalSupplierApi
  items: ProposalItemApi[]
}

export type QuotationRoundProposalsApi = {
  id: string
  round_number: number
  status: string
  response_deadline: string | null
  created_at: string | null
  closed_at: string | null
  proposals: ProposalApi[]
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function pickSupplier(
  raw:
    | { code: string; name: string; cnpj: string | null }
    | { code: string; name: string; cnpj: string | null }[]
    | null,
): { code: string; name: string; cnpj: string | null } | null {
  if (!raw) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

export function mapProposalItemToApi(
  row: Record<string, unknown>,
  quotationItems: Map<string, QuotationItemContext>,
): ProposalItemApi {
  const quotationItemId = String(row.quotation_item_id ?? "")
  const qi = quotationItems.get(quotationItemId)
  const unitPrice = toNumber(row.unit_price)
  const quantity = qi?.quantity ?? 0
  const lineTotal = unitPrice != null ? unitPrice * quantity : null

  return {
    quotation_item_id: quotationItemId,
    material_code: qi?.material_code ?? null,
    material_description: qi?.material_description ?? "",
    long_description: qi?.long_description ?? null,
    unit_of_measure: qi?.unit_of_measure ?? null,
    quantity,
    unit_price: unitPrice,
    tax_percent: toNumber(row.tax_percent),
    delivery_days: toNumber(row.delivery_days),
    item_status: String(row.item_status ?? "not_answered"),
    observations: row.observations != null ? String(row.observations) : null,
    line_total: lineTotal,
  }
}

export function mapProposalToApi(
  row: Record<string, unknown>,
  quotationItems: Map<string, QuotationItemContext>,
): ProposalApi {
  const supplierRaw = pickSupplier(
    row.suppliers as
      | { code: string; name: string; cnpj: string | null }
      | { code: string; name: string; cnpj: string | null }[]
      | null,
  )

  const proposalItems = (row.proposal_items ?? []) as Record<string, unknown>[]
  const roundId = row.round_id != null ? String(row.round_id) : null

  const items = proposalItems
    .filter((item) => {
      if (!roundId) return true
      const itemRoundId = item.round_id != null ? String(item.round_id) : null
      return itemRoundId == null || itemRoundId === roundId
    })
    .map((item) => mapProposalItemToApi(item, quotationItems))

  return {
    id: String(row.id),
    status: String(row.status),
    submitted_at: row.updated_at != null ? String(row.updated_at) : null,
    payment_condition: row.payment_condition != null ? String(row.payment_condition) : null,
    delivery_days: toNumber(row.delivery_days),
    total_price: toNumber(row.total_price),
    validity_date: row.validity_date != null ? String(row.validity_date) : null,
    observations: row.observations != null ? String(row.observations) : null,
    supplier: {
      id: String(row.supplier_id ?? ""),
      code: supplierRaw?.code ?? null,
      name: supplierRaw?.name ?? null,
      cnpj: supplierRaw?.cnpj ?? null,
    },
    items,
  }
}

export function buildRoundsWithProposals(
  rounds: Record<string, unknown>[],
  proposals: Record<string, unknown>[],
  quotationItems: Map<string, QuotationItemContext>,
): QuotationRoundProposalsApi[] {
  const proposalsByRound = new Map<string, ProposalApi[]>()

  for (const proposal of proposals) {
    const roundId = proposal.round_id != null ? String(proposal.round_id) : ""
    if (!roundId) continue
    const mapped = mapProposalToApi(proposal, quotationItems)
    const list = proposalsByRound.get(roundId) ?? []
    list.push(mapped)
    proposalsByRound.set(roundId, list)
  }

  return rounds.map((round) => {
    const roundId = String(round.id)
    return {
      id: roundId,
      round_number: Number(round.round_number ?? 0),
      status: String(round.status ?? ""),
      response_deadline:
        round.response_deadline != null ? String(round.response_deadline) : null,
      created_at: round.created_at != null ? String(round.created_at) : null,
      closed_at: round.closed_at != null ? String(round.closed_at) : null,
      proposals: proposalsByRound.get(roundId) ?? [],
    }
  })
}
