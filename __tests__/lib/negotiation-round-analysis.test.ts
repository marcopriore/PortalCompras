import { describe, expect, it } from "vitest"
import {
  evaluateNoImprovementStop,
  evaluateCeilingConvergence,
  mergeRoundMetrics,
  readRoundMetricsState,
} from "@/lib/negotiation/round-analysis"
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

describe("negotiation round-analysis", () => {
  it("mergeRoundMetrics calcula melhoria percentual", () => {
    const current = readRoundMetricsState({
      rounds_closed_in_run: 1,
      last_round_best_total: 1000,
      round_snapshots: [],
    })
    const merged = mergeRoundMetrics(current, {
      round_id: "r2",
      round_number: 2,
      best_total: 900,
      items_with_offer: 3,
      ceiling_violations: 0,
    })
    expect(merged.last_improvement_pct).toBe(10)
    expect(merged.last_round_best_total).toBe(900)
  })

  it("stop_on_no_improvement encerra após min rodadas sem melhoria", () => {
    const plan = basePlan({ stop_on_no_improvement: true, min_rounds: 2 })
    const metrics = readRoundMetricsState({
      last_improvement_pct: 0,
      round_snapshots: [],
    })
    const result = evaluateNoImprovementStop(plan, metrics, 2)
    expect(result.stop).toBe(true)
  })

  it("ceiling convergence quando sem violações", () => {
    const result = evaluateCeilingConvergence({
      round_id: "r1",
      round_number: 1,
      best_total: 500,
      items_with_offer: 2,
      ceiling_violations: 0,
    })
    expect(result.converged).toBe(true)
  })
})
