import type { SupabaseClient } from "@supabase/supabase-js"
import type { NegotiationDecisionType } from "@/types/negotiation"

export type LogDecisionParams = {
  companyId: string
  planId: string
  runId?: string | null
  roundId?: string | null
  decisionType: NegotiationDecisionType
  action: string
  reason?: string | null
  payload?: Record<string, unknown>
  createdBy?: string | null
}

export async function logNegotiationDecision(
  db: SupabaseClient,
  params: LogDecisionParams,
): Promise<void> {
  const { error } = await db.from("negotiation_decision_logs").insert({
    company_id: params.companyId,
    plan_id: params.planId,
    run_id: params.runId ?? null,
    round_id: params.roundId ?? null,
    decision_type: params.decisionType,
    action: params.action,
    reason: params.reason ?? null,
    payload: params.payload ?? {},
    created_by: params.createdBy ?? null,
  })
  if (error) {
    console.error("logNegotiationDecision", error)
  }
}
