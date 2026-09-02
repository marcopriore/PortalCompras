import type { SupabaseClient } from "@supabase/supabase-js"
import type { NegotiationPlan } from "@/types/negotiation"

export type RoundBestSnapshot = {
  round_id: string
  round_number: number
  best_total: number
  items_with_offer: number
  ceiling_violations: number
}

export type RoundMetricsState = {
  start_round_number: number
  rounds_closed_in_run: number
  last_round_best_total: number | null
  previous_round_best_total: number | null
  last_improvement_pct: number | null
  round_snapshots: RoundBestSnapshot[]
}

export function readRoundMetricsState(
  metrics: Record<string, unknown> | null | undefined,
): RoundMetricsState {
  const raw = metrics ?? {}
  const snapshots = Array.isArray(raw.round_snapshots)
    ? (raw.round_snapshots as RoundBestSnapshot[])
    : []
  return {
    start_round_number: Number(raw.start_round_number) || 0,
    rounds_closed_in_run: Number(raw.rounds_closed_in_run) || 0,
    last_round_best_total:
      raw.last_round_best_total != null ? Number(raw.last_round_best_total) : null,
    previous_round_best_total:
      raw.previous_round_best_total != null
        ? Number(raw.previous_round_best_total)
        : null,
    last_improvement_pct:
      raw.last_improvement_pct != null ? Number(raw.last_improvement_pct) : null,
    round_snapshots: snapshots,
  }
}

export function mergeRoundMetrics(
  current: RoundMetricsState,
  snapshot: RoundBestSnapshot,
): RoundMetricsState {
  const previousTotal = current.last_round_best_total
  let lastImprovementPct: number | null = null
  if (previousTotal != null && previousTotal > 0) {
    lastImprovementPct =
      Math.round(((previousTotal - snapshot.best_total) / previousTotal) * 10000) / 100
  }

  return {
    ...current,
    previous_round_best_total: previousTotal,
    last_round_best_total: snapshot.best_total,
    last_improvement_pct: lastImprovementPct,
    round_snapshots: [...current.round_snapshots, snapshot],
  }
}

export function hasRoundImprovement(metrics: RoundMetricsState): boolean {
  if (metrics.last_improvement_pct == null) return true
  return metrics.last_improvement_pct > 0
}

export async function computeRoundBestSnapshot(
  db: SupabaseClient,
  companyId: string,
  quotationId: string,
  roundId: string,
  maxPricePctAboveBest: number,
): Promise<RoundBestSnapshot | null> {
  const { data: round } = await db
    .from("quotation_rounds")
    .select("id, round_number")
    .eq("id", roundId)
    .eq("company_id", companyId)
    .eq("quotation_id", quotationId)
    .maybeSingle()

  if (!round) return null

  const { data: items } = await db
    .from("quotation_items")
    .select("id, quantity")
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)

  if (!items?.length) return null

  const qtyByItem = new Map<string, number>()
  for (const item of items) {
    qtyByItem.set(String(item.id), Number(item.quantity) || 0)
  }

  const { data: proposals } = await db
    .from("quotation_proposals")
    .select("id")
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)
    .eq("round_id", roundId)
    .in("status", ["submitted", "selected"])

  if (!proposals?.length) {
    return {
      round_id: String(round.id),
      round_number: Number(round.round_number) || 0,
      best_total: 0,
      items_with_offer: 0,
      ceiling_violations: 0,
    }
  }

  const proposalIds = proposals.map((p) => p.id as string)
  const { data: proposalItems } = await db
    .from("proposal_items")
    .select("quotation_item_id, unit_price, item_status")
    .in("proposal_id", proposalIds)
    .eq("round_id", roundId)

  const bestByItem = new Map<string, number>()
  const maxByItem = new Map<string, number>()
  let ceilingViolations = 0

  for (const pi of proposalItems ?? []) {
    if (pi.item_status === "rejected") continue
    const price = Number(pi.unit_price)
    if (!Number.isFinite(price) || price <= 0) continue

    const qid = String(pi.quotation_item_id)
    const prevBest = bestByItem.get(qid)
    if (prevBest == null || price < prevBest) bestByItem.set(qid, price)
    const prevMax = maxByItem.get(qid)
    if (prevMax == null || price > prevMax) maxByItem.set(qid, price)
  }

  const ceilingFactor = 1 + maxPricePctAboveBest / 100
  for (const [qid, best] of bestByItem) {
    const maxPrice = maxByItem.get(qid) ?? best
    if (maxPrice > best * ceilingFactor + 1e-9) ceilingViolations += 1
  }

  let bestTotal = 0
  for (const [qid, best] of bestByItem) {
    const qty = qtyByItem.get(qid) ?? 0
    bestTotal += qty * best
  }

  return {
    round_id: String(round.id),
    round_number: Number(round.round_number) || 0,
    best_total: Math.round(bestTotal * 100) / 100,
    items_with_offer: bestByItem.size,
    ceiling_violations: ceilingViolations,
  }
}

export function evaluateNoImprovementStop(
  plan: NegotiationPlan,
  metrics: RoundMetricsState,
  roundsClosedInRun: number,
): { stop: boolean; reason: string } {
  if (!plan.stop_on_no_improvement) return { stop: false, reason: "" }
  if (roundsClosedInRun < plan.min_rounds) return { stop: false, reason: "" }
  if (roundsClosedInRun < 2) return { stop: false, reason: "" }
  if (metrics.last_improvement_pct == null) return { stop: false, reason: "" }
  if (metrics.last_improvement_pct > 0) return { stop: false, reason: "" }

  return {
    stop: true,
    reason:
      "Negociação concluída: última rodada não trouxe melhoria de preço em relação à anterior.",
  }
}

export function evaluateCeilingConvergence(
  snapshot: RoundBestSnapshot | null,
): { converged: boolean; reason: string } {
  if (!snapshot || snapshot.items_with_offer === 0) {
    return { converged: false, reason: "" }
  }
  if (snapshot.ceiling_violations > 0) {
    return { converged: false, reason: "" }
  }
  return {
    converged: true,
    reason:
      "Negociação concluída: todos os preços estão dentro do teto configurado em relação ao melhor preço por item.",
  }
}
