import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  NegotiationCounterOffer,
  NegotiationDecisionLog,
  NegotiationPlan,
  NegotiationRun,
} from "@/types/negotiation"
import { fetchCounterOffersForRun } from "@/lib/negotiation/counter-offers"
import { parseGroupKeyFromRationale } from "@/lib/negotiation/counter-offer-groups"
import { readRoundMetricsState } from "@/lib/negotiation/round-analysis"

export type NegotiationReportItemEvolution = {
  quotation_item_id: string
  material_code: string
  material_description: string
  target_price: number | null
  rounds: Array<{ round_number: number; best_unit_price: number | null }>
}

export type NegotiationReportGroupSummary = {
  group_key: string
  item_count: number
  best_total: number
  target_total: number
  saving_pct: number
}

export type NegotiationReportData = {
  quotation: {
    id: string
    code: string
    description: string
    company_name: string
  }
  plan: NegotiationPlan
  run: NegotiationRun
  metrics: ReturnType<typeof readRoundMetricsState>
  decision_logs: NegotiationDecisionLog[]
  counter_offers: NegotiationCounterOffer[]
  group_summaries: NegotiationReportGroupSummary[]
  item_evolution: NegotiationReportItemEvolution[]
}

export async function loadNegotiationReportData(
  db: SupabaseClient,
  companyId: string,
  runId: string,
): Promise<NegotiationReportData | null> {
  const { data: run } = await db
    .from("quotation_negotiation_runs")
    .select("*")
    .eq("id", runId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (!run) return null

  const { data: plan } = await db
    .from("quotation_negotiation_plans")
    .select("*")
    .eq("id", run.plan_id)
    .eq("company_id", companyId)
    .maybeSingle()

  if (!plan) return null

  const { data: quotation } = await db
    .from("quotations")
    .select("id, code, description, company_id, companies(name)")
    .eq("id", run.quotation_id)
    .eq("company_id", companyId)
    .maybeSingle()

  if (!quotation) return null

  const companyEmbed = quotation.companies as { name?: string } | { name?: string }[] | null
  const companyName = Array.isArray(companyEmbed)
    ? companyEmbed[0]?.name ?? ""
    : companyEmbed?.name ?? ""

  const [{ data: logs }, counterRows, itemEvolution] = await Promise.all([
    db
      .from("negotiation_decision_logs")
      .select("*")
      .eq("company_id", companyId)
      .eq("run_id", runId)
      .order("created_at", { ascending: true }),
    fetchCounterOffersForRun(db, companyId, runId),
    buildItemEvolution(db, companyId, String(run.quotation_id)),
  ])

  const counterOffers: NegotiationCounterOffer[] = counterRows.map((row) => ({
    id: row.id,
    company_id: row.company_id,
    plan_id: row.plan_id,
    run_id: row.run_id,
    round_id: row.round_id,
    quotation_item_id: row.quotation_item_id,
    supplier_id: row.supplier_id,
    target_unit_price: row.target_unit_price,
    current_best_unit_price: row.current_best_unit_price,
    rationale: row.rationale,
    source: row.source,
    created_at: row.created_at,
    material_code: row.quotation_items?.material_code ?? null,
    material_description: row.quotation_items?.material_description ?? null,
    supplier_name: row.suppliers?.name ?? null,
    group_key: parseGroupKeyFromRationale(row.rationale),
  }))

  const planTyped = plan as NegotiationPlan
  const groupSummaries = await buildGroupSummariesFromOffers(
    db,
    companyId,
    planTyped,
    counterOffers,
  )

  return {
    quotation: {
      id: String(quotation.id),
      code: String(quotation.code ?? ""),
      description: String(quotation.description ?? ""),
      company_name: companyName,
    },
    plan: planTyped,
    run: run as NegotiationRun,
    metrics: readRoundMetricsState(run.metrics as Record<string, unknown>),
    decision_logs: (logs ?? []) as NegotiationDecisionLog[],
    counter_offers: counterOffers,
    group_summaries: groupSummaries,
    item_evolution: itemEvolution,
  }
}

async function buildGroupSummariesFromOffers(
  db: SupabaseClient,
  companyId: string,
  plan: NegotiationPlan,
  offers: NegotiationCounterOffer[],
): Promise<NegotiationReportGroupSummary[]> {
  if (plan.strategy !== "by_category" && plan.strategy !== "by_cost_center") {
    return []
  }
  if (offers.length === 0) return []

  const itemIds = [...new Set(offers.map((o) => o.quotation_item_id))]
  const { data: qtyRows } = await db
    .from("quotation_items")
    .select("id, quantity")
    .eq("company_id", companyId)
    .in("id", itemIds)

  const qtyByItem = new Map<string, number>()
  for (const row of qtyRows ?? []) {
    const q = Number(row.quantity)
    qtyByItem.set(String(row.id), q > 0 ? q : 1)
  }

  const byGroup = new Map<
    string,
    { itemCount: number; bestTotal: number; targetTotal: number }
  >()

  for (const offer of offers) {
    const groupKey = offer.group_key ?? parseGroupKeyFromRationale(offer.rationale)
    if (!groupKey) continue
    const qty = qtyByItem.get(offer.quotation_item_id) ?? 1
    const best = offer.current_best_unit_price ?? 0
    const target = offer.target_unit_price
    if (best <= 0) continue

    const bucket = byGroup.get(groupKey) ?? {
      itemCount: 0,
      bestTotal: 0,
      targetTotal: 0,
    }
    bucket.itemCount += 1
    bucket.bestTotal += best * qty
    bucket.targetTotal += target * qty
    byGroup.set(groupKey, bucket)
  }

  return [...byGroup.entries()]
    .map(([group_key, bucket]) => ({
      group_key,
      item_count: bucket.itemCount,
      best_total: Math.round(bucket.bestTotal * 100) / 100,
      target_total: Math.round(bucket.targetTotal * 100) / 100,
      saving_pct:
        bucket.bestTotal > 0
          ? Math.round(
              ((bucket.bestTotal - bucket.targetTotal) / bucket.bestTotal) * 1000,
            ) / 10
          : 0,
    }))
    .sort((a, b) => a.group_key.localeCompare(b.group_key, "pt-BR"))
}

async function buildItemEvolution(
  db: SupabaseClient,
  companyId: string,
  quotationId: string,
): Promise<NegotiationReportItemEvolution[]> {
  const { data: items } = await db
    .from("quotation_items")
    .select("id, material_code, material_description, target_price")
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)
    .order("material_description", { ascending: true })

  const { data: rounds } = await db
    .from("quotation_rounds")
    .select("id, round_number")
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)
    .order("round_number", { ascending: true })

  if (!items?.length || !rounds?.length) return []

  const roundIds = rounds.map((r) => r.id as string)
  const { data: proposals } = await db
    .from("quotation_proposals")
    .select("id, round_id")
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)
    .in("round_id", roundIds)
    .in("status", ["submitted", "selected"])

  const proposalIds = (proposals ?? []).map((p) => p.id as string)
  const roundByProposal = new Map<string, string>()
  for (const p of proposals ?? []) {
    roundByProposal.set(String(p.id), String(p.round_id))
  }

  let proposalItems: { quotation_item_id: string; unit_price: number | string; proposal_id: string; item_status: string }[] = []
  if (proposalIds.length > 0) {
    const { data } = await db
      .from("proposal_items")
      .select("quotation_item_id, unit_price, proposal_id, item_status")
      .in("proposal_id", proposalIds)
    proposalItems = (data ?? []) as typeof proposalItems
  }

  const bestByRoundItem = new Map<string, number>()
  for (const pi of proposalItems) {
    if (pi.item_status === "rejected") continue
    const price = Number(pi.unit_price)
    if (!Number.isFinite(price) || price <= 0) continue
    const roundId = roundByProposal.get(String(pi.proposal_id))
    if (!roundId) continue
    const key = `${roundId}:${pi.quotation_item_id}`
    const prev = bestByRoundItem.get(key)
    if (prev == null || price < prev) bestByRoundItem.set(key, price)
  }

  return items.map((item) => ({
    quotation_item_id: String(item.id),
    material_code: String(item.material_code ?? ""),
    material_description: String(item.material_description ?? ""),
    target_price:
      item.target_price != null && Number(item.target_price) > 0
        ? Number(item.target_price)
        : null,
    rounds: rounds.map((round) => {
      const key = `${round.id}:${item.id}`
      const best = bestByRoundItem.get(key)
      return {
        round_number: Number(round.round_number) || 0,
        best_unit_price: best ?? null,
      }
    }),
  }))
}
