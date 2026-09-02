import type { NegotiationPlan, NegotiationStrategy } from "@/types/negotiation"

export type CounterOfferDraft = {
  quotation_item_id: string
  supplier_id: string | null
  target_unit_price: number
  current_best_unit_price: number | null
  rationale: string
  group_key?: string | null
}

export type ItemSnapshotForGrouping = {
  quotationItemId: string
  materialCode: string
  quantity: number
  targetPrice: number | null
  bestUnitPrice: number
  category: string | null
  costCenter: string | null
}

export function isGroupedStrategy(strategy: NegotiationStrategy): boolean {
  return strategy === "by_category" || strategy === "by_cost_center"
}

function roundPrice(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function formatPct(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`
}

function computeReferenceTarget(
  itemTargetPrice: number | null,
  bestUnitPrice: number,
  savingPct: number,
): number {
  const savingFactor = 1 - savingPct / 100
  if (itemTargetPrice != null && itemTargetPrice > 0) {
    const fromTarget = itemTargetPrice * savingFactor
    return roundPrice(Math.min(itemTargetPrice, fromTarget, bestUnitPrice))
  }
  return roundPrice(bestUnitPrice * savingFactor)
}

function groupKeyForSnapshot(
  snap: ItemSnapshotForGrouping,
  strategy: NegotiationStrategy,
): string {
  if (strategy === "by_category") {
    const label = snap.category?.trim()
    return label && label.length > 0 ? label : "Sem categoria"
  }
  const label = snap.costCenter?.trim()
  return label && label.length > 0 ? label : "Sem centro de custo"
}

export function groupSnapshotsByStrategy(
  snapshots: ItemSnapshotForGrouping[],
  strategy: NegotiationStrategy,
): Map<string, ItemSnapshotForGrouping[]> {
  const groups = new Map<string, ItemSnapshotForGrouping[]>()
  for (const snap of snapshots) {
    const key = groupKeyForSnapshot(snap, strategy)
    const list = groups.get(key) ?? []
    list.push(snap)
    groups.set(key, list)
  }
  return groups
}

export function buildGroupedItemDrafts(
  groupLabel: string,
  groupTypeLabel: "Categoria" | "Centro de custo",
  snaps: ItemSnapshotForGrouping[],
  plan: NegotiationPlan,
): CounterOfferDraft[] {
  const eligible = snaps.filter(
    (s) => s.bestUnitPrice > 0 && s.quantity > 0 && Number.isFinite(s.quantity),
  )
  if (eligible.length === 0) return []

  let groupBestTotal = 0
  for (const snap of eligible) {
    groupBestTotal += snap.bestUnitPrice * snap.quantity
  }
  if (groupBestTotal <= 0) return []

  const savingPct = plan.target_saving_pct_below_target
  const groupTargetTotal = groupBestTotal * (1 - savingPct / 100)
  const groupSavingVsBest =
    groupBestTotal > 0
      ? ((groupBestTotal - groupTargetTotal) / groupBestTotal) * 100
      : 0

  const drafts: CounterOfferDraft[] = []

  for (const snap of eligible) {
    const itemBestTotal = snap.bestUnitPrice * snap.quantity
    const share = itemBestTotal / groupBestTotal
    const itemTargetTotal = groupTargetTotal * share
    let targetUnit = roundPrice(itemTargetTotal / snap.quantity)

    const itemCap = computeReferenceTarget(
      snap.targetPrice,
      snap.bestUnitPrice,
      savingPct,
    )
    if (targetUnit > itemCap) targetUnit = itemCap
    if (targetUnit > snap.bestUnitPrice) targetUnit = snap.bestUnitPrice

    const savingVsBest =
      snap.bestUnitPrice > 0
        ? ((snap.bestUnitPrice - targetUnit) / snap.bestUnitPrice) * 100
        : 0

    drafts.push({
      quotation_item_id: snap.quotationItemId,
      supplier_id: null,
      target_unit_price: targetUnit,
      current_best_unit_price: snap.bestUnitPrice,
      group_key: groupLabel,
      rationale: `[${groupTypeLabel}: ${groupLabel}] Grupo com ${eligible.length} item(ns), saving ${formatPct(groupSavingVsBest)} no total. ${snap.materialCode}: melhor R$ ${snap.bestUnitPrice.toFixed(2)} → alvo R$ ${targetUnit.toFixed(2)} (${formatPct(savingVsBest)}).`,
    })
  }

  return drafts
}

export type GroupSummaryRow = {
  group_key: string
  group_type: "category" | "cost_center"
  item_count: number
  best_total: number
  target_total: number
  saving_pct: number
}

export function summarizeCounterOfferGroups(
  strategy: NegotiationStrategy,
  snapshots: ItemSnapshotForGrouping[],
  drafts: CounterOfferDraft[],
): GroupSummaryRow[] {
  if (!isGroupedStrategy(strategy)) return []

  const groupType = strategy === "by_category" ? "category" : "cost_center"
  const groups = groupSnapshotsByStrategy(snapshots, strategy)
  const targetByItem = new Map(
    drafts.map((d) => [d.quotation_item_id, d.target_unit_price]),
  )

  const rows: GroupSummaryRow[] = []
  for (const [groupKey, snaps] of groups) {
    let bestTotal = 0
    let targetTotal = 0
    let count = 0
    for (const snap of snaps) {
      if (snap.bestUnitPrice <= 0 || snap.quantity <= 0) continue
      const targetUnit = targetByItem.get(snap.quotationItemId)
      if (targetUnit == null) continue
      count += 1
      bestTotal += snap.bestUnitPrice * snap.quantity
      targetTotal += targetUnit * snap.quantity
    }
    if (count === 0) continue
    const savingPct =
      bestTotal > 0 ? ((bestTotal - targetTotal) / bestTotal) * 100 : 0
    rows.push({
      group_key: groupKey,
      group_type: groupType,
      item_count: count,
      best_total: roundPrice(bestTotal),
      target_total: roundPrice(targetTotal),
      saving_pct: Math.round(savingPct * 10) / 10,
    })
  }

  return rows.sort((a, b) => a.group_key.localeCompare(b.group_key, "pt-BR"))
}

export function parseGroupKeyFromRationale(rationale: string | null): string | null {
  if (!rationale) return null
  const match = rationale.match(/^\[(?:Categoria|Centro de custo): ([^\]]+)\]/)
  return match?.[1] ?? null
}
