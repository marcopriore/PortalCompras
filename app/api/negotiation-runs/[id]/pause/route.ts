import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { logNegotiationDecision } from "@/lib/negotiation/decision-log"
import { requireNegotiationApiContext } from "@/lib/negotiation/require-api-context"

export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteParams) {
  const ctx = await requireNegotiationApiContext()
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const { id: runId } = await params
  const service = createServiceRoleClient()
  const now = new Date().toISOString()

  const { data: run, error } = await service
    .from("quotation_negotiation_runs")
    .update({ status: "paused", paused_at: now, updated_at: now })
    .eq("id", runId)
    .eq("company_id", ctx.companyId)
    .select("*")
    .single()

  if (error || !run) {
    return NextResponse.json({ error: error?.message ?? "Execução não encontrada." }, { status: 404 })
  }

  await logNegotiationDecision(service, {
    companyId: ctx.companyId,
    planId: String(run.plan_id),
    runId,
    decisionType: "buyer",
    action: "pause",
    reason: "Comprador pausou a negociação assistida.",
    createdBy: ctx.userId,
  })

  return NextResponse.json({ run })
}
