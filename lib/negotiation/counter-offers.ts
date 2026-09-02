import type { SupabaseClient } from "@supabase/supabase-js"
import type { NegotiationPlan, NegotiationStrategy } from "@/types/negotiation"

export type CounterOfferDraft = {
  quotation_item_id: string
  supplier_id: string | null
  target_unit_price: number
  current_best_unit_price: number | null
  rationale: string
}

type ItemProposalSnapshot = {
  quotationItemId: string
  materialCode: string
  materialDescription: string
  targetPrice: number | null
  bestUnitPrice: number
  bySupplier: Map<string, { unitPrice: number; supplierName: string }>
}

function roundPrice(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function isPerSupplierStrategy(strategy: NegotiationStrategy): boolean {
  return strategy === "per_supplier"
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

function formatPct(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`
}

function buildPerItemDraft(
  snap: ItemProposalSnapshot,
  plan: NegotiationPlan,
): CounterOfferDraft | null {
  if (snap.bestUnitPrice <= 0) return null

  const refTarget = computeReferenceTarget(
    snap.targetPrice,
    snap.bestUnitPrice,
    plan.target_saving_pct_below_target,
  )

  const savingVsBest =
    snap.bestUnitPrice > 0
      ? ((snap.bestUnitPrice - refTarget) / snap.bestUnitPrice) * 100
      : 0

  const parts: string[] = [
    `Melhor proposta atual: R$ ${snap.bestUnitPrice.toFixed(2)}.`,
    `Alvo sugerido: R$ ${refTarget.toFixed(2)} (${formatPct(savingVsBest)} vs melhor).`,
  ]
  if (snap.targetPrice != null && snap.targetPrice > 0) {
    parts.push(`Preço alvo do item: R$ ${snap.targetPrice.toFixed(2)}.`)
  }

  return {
    quotation_item_id: snap.quotationItemId,
    supplier_id: null,
    target_unit_price: refTarget,
    current_best_unit_price: snap.bestUnitPrice,
    rationale: parts.join(" "),
  }
}

function buildPerSupplierDrafts(
  snap: ItemProposalSnapshot,
  plan: NegotiationPlan,
): CounterOfferDraft[] {
  if (snap.bestUnitPrice <= 0) return []

  const refTarget = computeReferenceTarget(
    snap.targetPrice,
    snap.bestUnitPrice,
    plan.target_saving_pct_below_target,
  )
  const savingFactor = 1 - plan.target_saving_pct_below_target / 100

  const drafts: CounterOfferDraft[] = []

  for (const [supplierId, { unitPrice, supplierName }] of snap.bySupplier) {
    if (unitPrice <= 0) continue

    let target = roundPrice(unitPrice * savingFactor)
    if (target > refTarget) {
      target = refTarget
    }
    if (target > unitPrice) {
      target = unitPrice
    }

    const savingVsOwn =
      unitPrice > 0 ? ((unitPrice - target) / unitPrice) * 100 : 0
    const gapVsBest =
      snap.bestUnitPrice > 0
        ? ((unitPrice - snap.bestUnitPrice) / snap.bestUnitPrice) * 100
        : 0

    const parts: string[] = [
      `${supplierName}: proposta R$ ${unitPrice.toFixed(2)}.`,
      `Alvo sugerido: R$ ${target.toFixed(2)} (${formatPct(savingVsOwn)} de redução).`,
      `Gap vs melhor: ${formatPct(gapVsBest)}.`,
    ]
    if (snap.targetPrice != null && snap.targetPrice > 0) {
      const savingVsCatalog =
        unitPrice > 0
          ? ((unitPrice - snap.targetPrice) / unitPrice) * 100
          : 0
      parts.push(
        `Saving vs alvo catálogo: ${formatPct(savingVsCatalog)}.`,
      )
    }

    drafts.push({
      quotation_item_id: snap.quotationItemId,
      supplier_id: supplierId,
      target_unit_price: target,
      current_best_unit_price: snap.bestUnitPrice,
      rationale: parts.join(" "),
    })
  }

  return drafts
}

export function buildCounterOfferDrafts(
  plan: NegotiationPlan,
  snapshots: ItemProposalSnapshot[],
): CounterOfferDraft[] {
  const perSupplier = isPerSupplierStrategy(plan.strategy)
  const drafts: CounterOfferDraft[] = []

  for (const snap of snapshots) {
    if (perSupplier) {
      drafts.push(...buildPerSupplierDrafts(snap, plan))
    } else {
      const draft = buildPerItemDraft(snap, plan)
      if (draft) drafts.push(draft)
    }
  }

  return drafts
}

async function loadRoundProposalSnapshots(
  db: SupabaseClient,
  companyId: string,
  quotationId: string,
  sourceRoundId: string,
): Promise<ItemProposalSnapshot[]> {
  const { data: items } = await db
    .from("quotation_items")
    .select("id, material_code, material_description, target_price")
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)

  if (!items?.length) return []

  const { data: proposals } = await db
    .from("quotation_proposals")
    .select("id, supplier_id, supplier_name, status")
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)
    .eq("round_id", sourceRoundId)
    .in("status", ["submitted", "selected"])

  if (!proposals?.length) return []

  const proposalIds = proposals.map((p) => p.id as string)
  const supplierByProposal = new Map<string, { id: string; name: string }>()
  for (const p of proposals) {
    supplierByProposal.set(String(p.id), {
      id: String(p.supplier_id),
      name: String(p.supplier_name ?? "Fornecedor"),
    })
  }

  const { data: proposalItems } = await db
    .from("proposal_items")
    .select("quotation_item_id, unit_price, proposal_id, item_status")
    .in("proposal_id", proposalIds)
    .eq("round_id", sourceRoundId)

  const byItem = new Map<string, ItemProposalSnapshot>()

  for (const item of items) {
    byItem.set(String(item.id), {
      quotationItemId: String(item.id),
      materialCode: String(item.material_code ?? ""),
      materialDescription: String(item.material_description ?? ""),
      targetPrice:
        item.target_price != null && Number(item.target_price) > 0
          ? Number(item.target_price)
          : null,
      bestUnitPrice: Infinity,
      bySupplier: new Map(),
    })
  }

  for (const pi of proposalItems ?? []) {
    if (pi.item_status === "rejected") continue
    const price = Number(pi.unit_price)
    if (!Number.isFinite(price) || price <= 0) continue

    const qid = String(pi.quotation_item_id)
    const snap = byItem.get(qid)
    if (!snap) continue

    const supplier = supplierByProposal.get(String(pi.proposal_id))
    if (!supplier) continue

    if (price < snap.bestUnitPrice) snap.bestUnitPrice = price
    snap.bySupplier.set(supplier.id, {
      unitPrice: price,
      supplierName: supplier.name,
    })
  }

  return [...byItem.values()].filter(
    (s) => s.bestUnitPrice !== Infinity && s.bySupplier.size > 0,
  )
}

export async function generateAndPersistCounterOffers(
  db: SupabaseClient,
  params: {
    companyId: string
    plan: NegotiationPlan
    runId: string
    sourceRoundId: string
    targetRoundId: string | null
  },
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const snapshots = await loadRoundProposalSnapshots(
    db,
    params.companyId,
    params.plan.quotation_id,
    params.sourceRoundId,
  )

  if (snapshots.length === 0) {
    return { ok: true, count: 0 }
  }

  const drafts = buildCounterOfferDrafts(params.plan, snapshots)
  if (drafts.length === 0) {
    return { ok: true, count: 0 }
  }

  await db
    .from("negotiation_counter_offers")
    .delete()
    .eq("run_id", params.runId)
    .eq("company_id", params.companyId)
    .is("round_id", null)

  const rows = drafts.map((d) => ({
    company_id: params.companyId,
    plan_id: params.plan.id,
    run_id: params.runId,
    round_id: params.targetRoundId,
    quotation_item_id: d.quotation_item_id,
    supplier_id: d.supplier_id,
    target_unit_price: d.target_unit_price,
    current_best_unit_price: d.current_best_unit_price,
    rationale: d.rationale,
    source: "ai" as const,
  }))

  const { error } = await db.from("negotiation_counter_offers").insert(rows)
  if (error) {
    return { ok: false, message: error.message }
  }

  return { ok: true, count: rows.length }
}

export async function assignPendingCounterOffersToRound(
  db: SupabaseClient,
  params: { companyId: string; runId: string; roundId: string },
): Promise<void> {
  await db
    .from("negotiation_counter_offers")
    .update({ round_id: params.roundId })
    .eq("run_id", params.runId)
    .eq("company_id", params.companyId)
    .is("round_id", null)
}

export type NegotiationCounterOfferRow = {
  id: string
  company_id: string
  plan_id: string
  run_id: string
  round_id: string | null
  quotation_item_id: string
  supplier_id: string | null
  target_unit_price: number
  current_best_unit_price: number | null
  rationale: string | null
  source: string
  created_at: string
  quotation_items?: {
    material_code: string | null
    material_description: string | null
  } | null
  suppliers?: { name: string | null } | null
}

export async function fetchCounterOffersForRun(
  db: SupabaseClient,
  companyId: string,
  runId: string,
  options?: { roundId?: string | null; pendingOnly?: boolean },
): Promise<NegotiationCounterOfferRow[]> {
  let query = db
    .from("negotiation_counter_offers")
    .select(
      `
      id,
      company_id,
      plan_id,
      run_id,
      round_id,
      quotation_item_id,
      supplier_id,
      target_unit_price,
      current_best_unit_price,
      rationale,
      source,
      created_at,
      quotation_items ( material_code, material_description ),
      suppliers ( name )
    `,
    )
    .eq("company_id", companyId)
    .eq("run_id", runId)
    .order("created_at", { ascending: true })

  if (options?.pendingOnly) {
    query = query.is("round_id", null)
  } else if (options?.roundId) {
    query = query.eq("round_id", options.roundId)
  }

  const { data, error } = await query
  if (error || !data) return []

  return (data as Record<string, unknown>[]).map((row) => {
    const qi = row.quotation_items
    const sup = row.suppliers
    const qiObj = Array.isArray(qi) ? qi[0] : qi
    const supObj = Array.isArray(sup) ? sup[0] : sup
    return {
      id: String(row.id),
      company_id: String(row.company_id),
      plan_id: String(row.plan_id),
      run_id: String(row.run_id),
      round_id: row.round_id != null ? String(row.round_id) : null,
      quotation_item_id: String(row.quotation_item_id),
      supplier_id: row.supplier_id != null ? String(row.supplier_id) : null,
      target_unit_price: Number(row.target_unit_price),
      current_best_unit_price:
        row.current_best_unit_price != null
          ? Number(row.current_best_unit_price)
          : null,
      rationale: (row.rationale as string | null) ?? null,
      source: String(row.source),
      created_at: String(row.created_at),
      quotation_items: qiObj
        ? {
            material_code: (qiObj as { material_code?: string | null }).material_code ?? null,
            material_description:
              (qiObj as { material_description?: string | null }).material_description ?? null,
          }
        : null,
      suppliers: supObj
        ? { name: (supObj as { name?: string | null }).name ?? null }
        : null,
    } satisfies NegotiationCounterOfferRow
  })
}
