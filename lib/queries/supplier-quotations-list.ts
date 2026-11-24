import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { queryKeys } from "@/lib/queries/keys"

export type SupplierQuotationsListRow = {
  id: string
  code: string
  description: string
  status: string
  createdAt: string
  companies: { name: string; cnpj: string | null } | null
  roundNumber: number | null
  responseDeadline: string | null
  proposalStatus: string | null
}

export type SupplierQuotationsListDto = {
  hasInvites: boolean
  metrics: {
    awaiting: number
    inAnalysis: number
    winners: number
    closed: number
  }
  rows: SupplierQuotationsListRow[]
}

type QuotationRow = {
  id: string
  code: string
  description: string
  status: string
  created_at: string
  company_id: string | null
}

type RoundRow = {
  id: string
  quotation_id: string
  round_number: number
  response_deadline: string | null
  status: string
}

type ProposalRow = {
  quotation_id: string
  round_id: string | null
  status: string
}

type CompanyMapValue = { name: string; cnpj: string | null }

export async function fetchSupplierQuotationsList(
  supabase: SupabaseClient,
  supplierId: string,
): Promise<SupplierQuotationsListDto> {
  const empty: SupplierQuotationsListDto = {
    hasInvites: false,
    metrics: { awaiting: 0, inAnalysis: 0, winners: 0, closed: 0 },
    rows: [],
  }

  const invitesRes = await supabase
    .from("quotation_suppliers")
    .select("quotation_id")
    .eq("supplier_id", supplierId)

  if (invitesRes.error) throw invitesRes.error

  const quotationIds = [
    ...new Set((invitesRes.data ?? []).map((r) => r.quotation_id)),
  ]

  if (quotationIds.length === 0) {
    return empty
  }

  const [roundsRes, selectedCountRes, submittedRowsRes, completedCountRes] =
    await Promise.all([
      supabase
        .from("quotation_rounds")
        .select("id, quotation_id, round_number, response_deadline, status")
        .in("quotation_id", quotationIds)
        .eq("status", "active"),
      supabase
        .from("quotation_proposals")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", supplierId)
        .eq("status", "selected"),
      supabase
        .from("quotation_proposals")
        .select("quotation_id")
        .eq("supplier_id", supplierId)
        .eq("status", "submitted"),
      supabase
        .from("quotations")
        .select("id", { count: "exact", head: true })
        .in("id", quotationIds)
        .eq("status", "completed"),
    ])

  if (
    roundsRes.error ||
    selectedCountRes.error ||
    submittedRowsRes.error ||
    completedCountRes.error
  ) {
    throw (
      roundsRes.error ||
      selectedCountRes.error ||
      submittedRowsRes.error ||
      completedCountRes.error
    )
  }

  const activeRounds = (roundsRes.data ?? []) as RoundRow[]
  const activeRoundIds = activeRounds.map((r) => r.id)

  let awaiting = 0
  if (activeRoundIds.length > 0) {
    const invitedCountRes = await supabase
      .from("quotation_proposals")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplierId)
      .eq("status", "invited")
      .in("round_id", activeRoundIds)
    if (invitedCountRes.error) throw invitedCountRes.error
    awaiting = invitedCountRes.count ?? 0
  }

  const submittedRows = (submittedRowsRes.data ?? []) as { quotation_id: string }[]
  const submittedQids = [...new Set(submittedRows.map((r) => r.quotation_id))]

  let inAnalysis = 0
  if (submittedQids.length > 0) {
    const { data: qaRows, error: qaErr } = await supabase
      .from("quotations")
      .select("id")
      .in("id", submittedQids)
      .in("status", ["waiting", "analysis"])
    if (qaErr) throw qaErr
    const allowed = new Set((qaRows ?? []).map((q) => q.id))
    inAnalysis = submittedRows.filter((r) => allowed.has(r.quotation_id)).length
  }

  const metrics = {
    awaiting,
    inAnalysis,
    winners: selectedCountRes.count ?? 0,
    closed: completedCountRes.count ?? 0,
  }

  const quotationsRes = await supabase
    .from("quotations")
    .select("id, code, description, status, created_at, company_id")
    .in("id", quotationIds)

  if (quotationsRes.error) throw quotationsRes.error

  const quotationRows = (quotationsRes.data ?? []) as QuotationRow[]

  const companyIds = [
    ...new Set(quotationRows.map((q) => q.company_id).filter(Boolean)),
  ] as string[]

  let companyMap: Record<string, CompanyMapValue> = {}
  if (companyIds.length > 0) {
    const { data: companiesData, error: companiesErr } = await supabase
      .from("companies")
      .select("id, name, cnpj")
      .in("id", companyIds)
    if (!companiesErr && companiesData) {
      companyMap = Object.fromEntries(
        companiesData.map((c) => [c.id, { name: c.name, cnpj: c.cnpj ?? null }]),
      )
    }
  }

  const roundsForTableRes = await supabase
    .from("quotation_rounds")
    .select("id, quotation_id, round_number, response_deadline, status")
    .in("quotation_id", quotationIds)
    .eq("status", "active")
  if (roundsForTableRes.error) throw roundsForTableRes.error

  const activeRoundsTable = (roundsForTableRes.data ?? []) as RoundRow[]
  const roundByQuotation = new Map<string, RoundRow>()
  for (const r of activeRoundsTable) {
    roundByQuotation.set(r.quotation_id, r)
  }

  let baseRows: SupplierQuotationsListRow[] = quotationRows.map((q) => {
    const ar = roundByQuotation.get(q.id) ?? null
    const coRaw = q.company_id ? companyMap[q.company_id] : undefined
    const companies = coRaw ? { name: coRaw.name, cnpj: coRaw.cnpj } : null
    return {
      id: q.id,
      code: q.code,
      description: q.description,
      status: q.status,
      createdAt: q.created_at,
      companies,
      roundNumber: ar?.round_number ?? null,
      responseDeadline: ar?.response_deadline ?? null,
      proposalStatus: null,
    }
  })

  baseRows.sort((a, b) => {
    const da = a.responseDeadline
      ? new Date(`${a.responseDeadline}T00:00:00`).getTime()
      : Number.POSITIVE_INFINITY
    const db = b.responseDeadline
      ? new Date(`${b.responseDeadline}T00:00:00`).getTime()
      : Number.POSITIVE_INFINITY
    return da - db
  })

  const myProposalsRes = await supabase
    .from("quotation_proposals")
    .select("quotation_id, round_id, status")
    .eq("supplier_id", supplierId)
    .in("quotation_id", quotationIds)

  if (myProposalsRes.error) throw myProposalsRes.error
  const myProposalsRows = (myProposalsRes.data ?? []) as ProposalRow[]

  const priority: Record<string, number> = {
    selected: 4,
    submitted: 3,
    invited: 2,
    rejected: 1,
  }

  const proposalStatusByQuotation = new Map<string, string>()
  const proposalRankByQuotation = new Map<string, number>()

  for (const p of myProposalsRows) {
    const cur = proposalRankByQuotation.get(p.quotation_id) ?? 0
    const next = priority[p.status] ?? 0
    if (next > cur) {
      proposalRankByQuotation.set(p.quotation_id, next)
      proposalStatusByQuotation.set(p.quotation_id, p.status)
    }
  }

  baseRows = baseRows.map((r) => ({
    ...r,
    proposalStatus: proposalStatusByQuotation.get(r.id) ?? null,
  }))

  return {
    hasInvites: true,
    metrics,
    rows: baseRows,
  }
}

export type SupabaseClientFactory = () => SupabaseClient

export function supplierQuotationsListQueryOptions(
  companyId: string,
  supplierId: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.supplierQuotationsList(companyId, supplierId),
    queryFn: () => fetchSupplierQuotationsList(supabaseFactory(), supplierId),
    enabled: Boolean(companyId && supplierId),
  })
}