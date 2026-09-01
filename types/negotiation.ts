export type NegotiationPlanStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "cancelled"

export type NegotiationRunStatus =
  | "pending"
  | "running"
  | "waiting_deadline"
  | "analyzing"
  | "opening_round"
  | "paused"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled"

export type NegotiationStrategy =
  | "per_item"
  | "per_supplier"
  | "by_category"
  | "by_cost_center"

export type NegotiationDecisionType = "system" | "ai" | "buyer"

export type NegotiationDecisionLog = {
  id: string
  company_id: string
  plan_id: string | null
  run_id: string | null
  round_id: string | null
  decision_type: NegotiationDecisionType
  action: string
  reason: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

export type NegotiationPlan = {
  id: string
  company_id: string
  quotation_id: string
  created_by: string | null
  status: NegotiationPlanStatus
  min_rounds: number
  max_rounds: number
  max_price_pct_above_best: number
  target_saving_pct_below_target: number
  stop_on_target: boolean
  stop_on_no_improvement: boolean
  strategy: NegotiationStrategy
  require_buyer_approval: boolean
  response_deadline_days: number
  notes: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
}

export type NegotiationRun = {
  id: string
  company_id: string
  plan_id: string
  quotation_id: string
  status: NegotiationRunStatus
  current_round_number: number
  current_round_id: string | null
  rounds_opened: number
  last_improvement_at: string | null
  metrics: Record<string, unknown>
  last_error: string | null
  started_at: string | null
  paused_at: string | null
  completed_at: string | null
  last_tick_at: string | null
  created_at: string
  updated_at: string
}

export type NegotiationPlanInput = {
  min_rounds?: number
  max_rounds?: number
  max_price_pct_above_best?: number
  target_saving_pct_below_target?: number
  stop_on_target?: boolean
  stop_on_no_improvement?: boolean
  strategy?: NegotiationStrategy
  require_buyer_approval?: boolean
  response_deadline_days?: number
  notes?: string | null
}

export const DEFAULT_NEGOTIATION_PLAN: Required<
  Pick<
    NegotiationPlanInput,
    | "min_rounds"
    | "max_rounds"
    | "max_price_pct_above_best"
    | "target_saving_pct_below_target"
    | "stop_on_target"
    | "stop_on_no_improvement"
    | "strategy"
    | "require_buyer_approval"
    | "response_deadline_days"
  >
> = {
  min_rounds: 3,
  max_rounds: 5,
  max_price_pct_above_best: 5,
  target_saving_pct_below_target: 15,
  stop_on_target: true,
  stop_on_no_improvement: true,
  strategy: "per_item",
  require_buyer_approval: true,
  response_deadline_days: 5,
}

export function normalizeNegotiationPlanInput(
  input: NegotiationPlanInput,
): typeof DEFAULT_NEGOTIATION_PLAN & { notes: string | null } {
  const minRounds = Math.min(
    20,
    Math.max(1, Math.trunc(input.min_rounds ?? DEFAULT_NEGOTIATION_PLAN.min_rounds)),
  )
  const maxRounds = Math.min(
    30,
    Math.max(minRounds, Math.trunc(input.max_rounds ?? DEFAULT_NEGOTIATION_PLAN.max_rounds)),
  )
  return {
    min_rounds: minRounds,
    max_rounds: maxRounds,
    max_price_pct_above_best: clamp(
      input.max_price_pct_above_best ?? DEFAULT_NEGOTIATION_PLAN.max_price_pct_above_best,
      0,
      100,
    ),
    target_saving_pct_below_target: clamp(
      input.target_saving_pct_below_target ??
        DEFAULT_NEGOTIATION_PLAN.target_saving_pct_below_target,
      0,
      100,
    ),
    stop_on_target: input.stop_on_target ?? DEFAULT_NEGOTIATION_PLAN.stop_on_target,
    stop_on_no_improvement:
      input.stop_on_no_improvement ?? DEFAULT_NEGOTIATION_PLAN.stop_on_no_improvement,
    strategy: input.strategy ?? DEFAULT_NEGOTIATION_PLAN.strategy,
    require_buyer_approval:
      input.require_buyer_approval ?? DEFAULT_NEGOTIATION_PLAN.require_buyer_approval,
    response_deadline_days: Math.min(
      60,
      Math.max(
        1,
        Math.trunc(
          input.response_deadline_days ?? DEFAULT_NEGOTIATION_PLAN.response_deadline_days,
        ),
      ),
    ),
    notes: input.notes?.trim() || null,
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}
