import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { requireNegotiationApiContext } from "@/lib/negotiation/require-api-context"
import { normalizeNegotiationPlanInput } from "@/types/negotiation"

export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  const ctx = await requireNegotiationApiContext()
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const { id: quotationId } = await params
  const service = createServiceRoleClient()

  const { data: plans, error } = await service
    .from("quotation_negotiation_plans")
    .select("*")
    .eq("company_id", ctx.companyId)
    .eq("quotation_id", quotationId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const planIds = (plans ?? []).map((p) => p.id as string)
  let runs: unknown[] = []
  let decisionLogs: unknown[] = []
  if (planIds.length > 0) {
    const { data: runRows } = await service
      .from("quotation_negotiation_runs")
      .select("*")
      .eq("company_id", ctx.companyId)
      .in("plan_id", planIds)
      .order("created_at", { ascending: false })
    runs = runRows ?? []

    const runIds = (runRows ?? []).map((r) => r.id as string)
    if (runIds.length > 0) {
      const { data: logRows } = await service
        .from("negotiation_decision_logs")
        .select("*")
        .eq("company_id", ctx.companyId)
        .in("run_id", runIds)
        .order("created_at", { ascending: false })
        .limit(40)
      decisionLogs = logRows ?? []
    }
  }

  return NextResponse.json({ plans: plans ?? [], runs, decisionLogs })
}

export async function POST(request: Request, { params }: RouteParams) {
  const ctx = await requireNegotiationApiContext()
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const { id: quotationId } = await params
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    body = {}
  }

  const normalized = normalizeNegotiationPlanInput({
    min_rounds: body.min_rounds != null ? Number(body.min_rounds) : undefined,
    max_rounds: body.max_rounds != null ? Number(body.max_rounds) : undefined,
    max_price_pct_above_best:
      body.max_price_pct_above_best != null
        ? Number(body.max_price_pct_above_best)
        : undefined,
    target_saving_pct_below_target:
      body.target_saving_pct_below_target != null
        ? Number(body.target_saving_pct_below_target)
        : undefined,
    stop_on_target:
      body.stop_on_target != null ? Boolean(body.stop_on_target) : undefined,
    stop_on_no_improvement:
      body.stop_on_no_improvement != null
        ? Boolean(body.stop_on_no_improvement)
        : undefined,
    strategy:
      typeof body.strategy === "string"
        ? (body.strategy as "per_item" | "per_supplier" | "by_category" | "by_cost_center")
        : undefined,
    require_buyer_approval:
      body.require_buyer_approval != null
        ? Boolean(body.require_buyer_approval)
        : undefined,
    response_deadline_days:
      body.response_deadline_days != null
        ? Number(body.response_deadline_days)
        : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
  })

  const service = createServiceRoleClient()

  const { data: quotation } = await service
    .from("quotations")
    .select("id")
    .eq("id", quotationId)
    .eq("company_id", ctx.companyId)
    .maybeSingle()

  if (!quotation) {
    return NextResponse.json({ error: "Cotação não encontrada." }, { status: 404 })
  }

  const { data: plan, error } = await service
    .from("quotation_negotiation_plans")
    .insert({
      company_id: ctx.companyId,
      quotation_id: quotationId,
      created_by: ctx.userId,
      status: "draft",
      ...normalized,
    })
    .select("*")
    .single()

  if (error || !plan) {
    return NextResponse.json({ error: error?.message ?? "Erro ao criar plano." }, { status: 500 })
  }

  return NextResponse.json({ plan })
}
