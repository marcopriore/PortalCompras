import { describe, expect, it } from "vitest"
import {
  buildGroupedItemDrafts,
  groupSnapshotsByStrategy,
  parseGroupKeyFromRationale,
} from "@/lib/negotiation/counter-offer-groups"
import { buildCounterOfferDrafts } from "@/lib/negotiation/counter-offers"
import { effectiveSavingPctForSupplier } from "@/lib/negotiation/score-adjustment"
import type { NegotiationPlan } from "@/types/negotiation"
import { DEFAULT_NEGOTIATION_PLAN } from "@/types/negotiation"

function basePlan(overrides?: Partial<NegotiationPlan>): NegotiationPlan {
  return {
    id: "plan-1",
    company_id: "co-1",
    quotation_id: "q-1",
    created_by: null,
    status: "active",
    notes: null,
    created_at: "",
    updated_at: "",
    started_at: null,
    completed_at: null,
    ...DEFAULT_NEGOTIATION_PLAN,
    ...overrides,
  } as NegotiationPlan
}

describe("negotiation counter-offers fase 2.4", () => {
  it("agrupa por categoria e distribui saving proporcional", () => {
    const plan = basePlan({
      strategy: "by_category",
      target_saving_pct_below_target: 10,
    })
    const snapshots = [
      {
        quotationItemId: "i1",
        materialCode: "A",
        materialDescription: "Item A",
        quantity: 10,
        targetPrice: null,
        bestUnitPrice: 100,
        category: "TI",
        costCenter: null,
        bySupplier: new Map(),
      },
      {
        quotationItemId: "i2",
        materialCode: "B",
        materialDescription: "Item B",
        quantity: 5,
        targetPrice: null,
        bestUnitPrice: 200,
        category: "TI",
        costCenter: null,
        bySupplier: new Map(),
      },
    ]

    const drafts = buildCounterOfferDrafts(plan, snapshots)
    expect(drafts).toHaveLength(2)
    expect(drafts[0]?.group_key).toBe("TI")
    expect(drafts[0]?.rationale).toContain("[Categoria: TI]")
    const totalBest = 10 * 100 + 5 * 200
    const totalTarget = drafts.reduce((sum, d, idx) => {
      const qty = idx === 0 ? 10 : 5
      return sum + d.target_unit_price * qty
    }, 0)
    expect(totalTarget).toBeCloseTo(totalBest * 0.9, 1)
  })

  it("by_cost_center usa grupos distintos", () => {
    const groups = groupSnapshotsByStrategy(
      [
        {
          quotationItemId: "i1",
          materialCode: "A",
          quantity: 1,
          targetPrice: null,
          bestUnitPrice: 50,
          category: null,
          costCenter: "CC-01",
        },
        {
          quotationItemId: "i2",
          materialCode: "B",
          quantity: 1,
          targetPrice: null,
          bestUnitPrice: 60,
          category: null,
          costCenter: "CC-02",
        },
      ],
      "by_cost_center",
    )
    expect(groups.size).toBe(2)
    expect(groups.has("CC-01")).toBe(true)
  })

  it("per_supplier ajusta saving pelo score", () => {
    const highScoreSaving = effectiveSavingPctForSupplier(15, 85)
    const lowScoreSaving = effectiveSavingPctForSupplier(15, 30)
    expect(highScoreSaving).toBeLessThan(15)
    expect(lowScoreSaving).toBeGreaterThan(15)
  })

  it("parseGroupKeyFromRationale extrai rótulo", () => {
    expect(
      parseGroupKeyFromRationale("[Categoria: EPI] Grupo com 3 item(ns)"),
    ).toBe("EPI")
    expect(parseGroupKeyFromRationale(null)).toBeNull()
  })

  it("buildGroupedItemDrafts retorna vazio sem itens elegíveis", () => {
    const plan = basePlan({ strategy: "by_category" })
    const drafts = buildGroupedItemDrafts("Vazio", "Categoria", [], plan)
    expect(drafts).toHaveLength(0)
  })
})
