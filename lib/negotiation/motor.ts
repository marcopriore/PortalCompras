import type { SupabaseClient } from "@supabase/supabase-js"
import type { NegotiationPlan, NegotiationRun, NegotiationRunStatus } from "@/types/negotiation"
import {
  assignPendingCounterOffersToRound,
  generateAndPersistCounterOffers,
} from "@/lib/negotiation/counter-offers"
import { logNegotiationDecision } from "@/lib/negotiation/decision-log"
import {
  closeQuotationRound,
  countSubmittedProposals,
  deadlineFromDays,
  ensureInitialQuotationRound,
  isRoundDeadlinePassed,
  openQuotationRound,
} from "@/lib/quotations/round-lifecycle"

type TickResult =
  | { ok: true; run: NegotiationRun; message: string }
  | { ok: false; message: string }

type RunMetrics = {
  start_round_number: number
  rounds_closed_in_run: number
}

function readRunMetrics(run: NegotiationRun): RunMetrics {
  const raw = run.metrics ?? {}
  return {
    start_round_number: Number(raw.start_round_number) || 0,
    rounds_closed_in_run: Number(raw.rounds_closed_in_run) || 0,
  }
}

export async function advanceNegotiationRun(
  db: SupabaseClient,
  companyId: string,
  runId: string,
  options?: { actorUserId?: string; forceApprove?: boolean },
): Promise<TickResult> {
  return tickNegotiationRun(db, companyId, runId, options)
}

const TICK_LOCK_STALE_MS = 60_000

async function releaseTickLock(
  db: SupabaseClient,
  runId: string,
  companyId: string,
): Promise<void> {
  await db
    .from("quotation_negotiation_runs")
    .update({ tick_in_progress_at: null, updated_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("company_id", companyId)
}

async function claimTickLock(
  db: SupabaseClient,
  companyId: string,
  runId: string,
): Promise<NegotiationRun | null> {
  const now = new Date().toISOString()
  const staleBefore = new Date(Date.now() - TICK_LOCK_STALE_MS).toISOString()
  const patch = { tick_in_progress_at: now, updated_at: now }

  const { data: claimedNull, error: nullErr } = await db
    .from("quotation_negotiation_runs")
    .update(patch)
    .eq("id", runId)
    .eq("company_id", companyId)
    .is("tick_in_progress_at", null)
    .select("*")
    .maybeSingle()

  if (!nullErr && claimedNull) return claimedNull as NegotiationRun

  const { data: claimedStale, error: staleErr } = await db
    .from("quotation_negotiation_runs")
    .update(patch)
    .eq("id", runId)
    .eq("company_id", companyId)
    .lt("tick_in_progress_at", staleBefore)
    .select("*")
    .maybeSingle()

  if (!staleErr && claimedStale) return claimedStale as NegotiationRun
  return null
}

export async function tickNegotiationRun(
  db: SupabaseClient,
  companyId: string,
  runId: string,
  options?: { actorUserId?: string; forceApprove?: boolean },
): Promise<TickResult> {
  const run = await claimTickLock(db, companyId, runId)
  if (!run) {
    const { data: runRow } = await db
      .from("quotation_negotiation_runs")
      .select("*")
      .eq("id", runId)
      .eq("company_id", companyId)
      .maybeSingle()
    if (!runRow) {
      return { ok: false, message: "Execução não encontrada." }
    }
    return {
      ok: true,
      run: runRow as NegotiationRun,
      message: "Nenhuma ação necessária.",
    }
  }

  try {
    return await executeNegotiationTick(db, companyId, run, options)
  } finally {
    await releaseTickLock(db, runId, companyId)
  }
}

async function executeNegotiationTick(
  db: SupabaseClient,
  companyId: string,
  run: NegotiationRun,
  options?: { actorUserId?: string; forceApprove?: boolean },
): Promise<TickResult> {
  if (run.status === "completed" || run.status === "cancelled" || run.status === "failed") {
    return { ok: false, message: `Execução já encerrada (${run.status}).` }
  }

  const { data: planRow, error: planErr } = await db
    .from("quotation_negotiation_plans")
    .select("*")
    .eq("id", run.plan_id)
    .eq("company_id", companyId)
    .maybeSingle()

  if (planErr || !planRow) {
    return { ok: false, message: "Plano não encontrado." }
  }

  const plan = planRow as NegotiationPlan

  const { data: quotation, error: qErr } = await db
    .from("quotations")
    .select("id, code, status")
    .eq("id", run.quotation_id)
    .eq("company_id", companyId)
    .maybeSingle()

  if (qErr || !quotation) {
    return { ok: false, message: "Cotação não encontrada." }
  }

  const quotationCode = String(quotation.code ?? "")
  const now = new Date().toISOString()

  if (run.status === "awaiting_approval" && !options?.forceApprove) {
    return {
      ok: true,
      run,
      message: "Aguardando aprovação do comprador para abrir a próxima rodada.",
    }
  }

  if (run.status === "paused") {
    return { ok: true, run, message: "Execução pausada." }
  }

  let nextStatus = run.status
  let message = "Nenhuma ação necessária."
  let currentRoundId = run.current_round_id
  let currentRoundNumber = run.current_round_number
  let roundsOpened = run.rounds_opened
  let runMetrics = readRunMetrics(run)

  if (run.status === "awaiting_approval" && options?.forceApprove) {
    await logNegotiationDecision(db, {
      companyId,
      planId: plan.id,
      runId: run.id,
      roundId: currentRoundId,
      decisionType: "buyer",
      action: "approve_round",
      reason: "Comprador aprovou abertura da próxima rodada.",
      createdBy: options?.actorUserId ?? null,
    })
    nextStatus = "opening_round"
    message = "Aprovação registrada. Abrindo próxima rodada."
  }

  if (run.status === "pending" || run.status === "running") {
    const activeRound = await findActiveRound(db, companyId, run.quotation_id)
    if (!activeRound) {
      return { ok: false, message: "Não há rodada ativa para monitorar." }
    }
    currentRoundId = activeRound.id
    currentRoundNumber = activeRound.round_number
    nextStatus = "waiting_deadline"
    message = "Monitorando prazo da rodada ativa."
  }

  if (nextStatus === "waiting_deadline" && currentRoundId) {
    const counts = await countSubmittedProposals(db, companyId, currentRoundId)
    const deadlinePassed = await isRoundDeadlinePassed(db, companyId, currentRoundId)
    const allResponded = counts.invited > 0 && counts.submitted >= counts.invited

    if (allResponded || deadlinePassed) {
      const closed = await closeQuotationRound(db, {
        companyId,
        quotationId: run.quotation_id,
        roundId: currentRoundId,
        setQuotationAnalysis: true,
      })
      if (!closed.ok) return { ok: false, message: closed.message }

      await logNegotiationDecision(db, {
        companyId,
        planId: plan.id,
        runId: run.id,
        roundId: currentRoundId,
        decisionType: "system",
        action: "close_round",
        reason: allResponded ? "Todos os fornecedores responderam." : "Prazo da rodada expirado.",
        payload: { counts, deadlinePassed },
        createdBy: options?.actorUserId ?? null,
      })

      runMetrics = {
        ...runMetrics,
        rounds_closed_in_run: runMetrics.rounds_closed_in_run + 1,
      }

      nextStatus = "analyzing"
      message = "Rodada encerrada. A IA está analisando os resultados."
    } else if (counts.invited > 0) {
      message = `Aguardando fornecedores (${counts.submitted}/${counts.invited} responderam).`
    }
  }

  if (nextStatus === "analyzing") {
    const closedInRun = runMetrics.rounds_closed_in_run
    const shouldStop = await evaluateStopCriteria(db, companyId, plan, closedInRun)
    if (shouldStop.stop) {
      const completed = await completeRun(
        db,
        companyId,
        plan,
        run,
        shouldStop.reason,
        options?.actorUserId,
        runMetrics,
      )
      return { ok: true, run: completed, message: shouldStop.reason }
    }

    const sourceRoundId = currentRoundId ?? run.current_round_id
    if (sourceRoundId) {
      const counterResult = await generateAndPersistCounterOffers(db, {
        companyId,
        plan,
        runId: run.id,
        sourceRoundId,
        targetRoundId: null,
      })
      if (!counterResult.ok) {
        return { ok: false, message: counterResult.message }
      }
      if (counterResult.count > 0) {
        await logNegotiationDecision(db, {
          companyId,
          planId: plan.id,
          runId: run.id,
          roundId: sourceRoundId,
          decisionType: "ai",
          action: "counter_offers_generated",
          reason: `${counterResult.count} alvo(s) de preço calculado(s) para a próxima rodada.`,
          payload: { count: counterResult.count, strategy: plan.strategy },
          createdBy: options?.actorUserId ?? null,
        })
      }
    }

    if (plan.require_buyer_approval && !options?.forceApprove) {
      const continueReason = await describeContinueReason(db, companyId, plan, closedInRun)
      const awaiting = await updateRun(db, run.id, companyId, {
        status: "awaiting_approval",
        last_tick_at: now,
        current_round_id: currentRoundId,
        current_round_number: currentRoundNumber,
        metrics: runMetrics,
      })
      await logNegotiationDecision(db, {
        companyId,
        planId: plan.id,
        runId: run.id,
        decisionType: "ai",
        action: "await_approval",
        reason: continueReason,
        createdBy: options?.actorUserId ?? null,
      })
      return {
        ok: true,
        run: awaiting,
        message: continueReason,
      }
    }

    nextStatus = "opening_round"
    message = await describeContinueReason(db, companyId, plan, closedInRun)
  }

  if (nextStatus === "opening_round") {
    const sourceRoundId = await findLatestRoundId(db, companyId, run.quotation_id)
    if (!sourceRoundId) {
      return { ok: false, message: "Não foi possível identificar rodada anterior." }
    }

    const opened = await openQuotationRound(db, {
      companyId,
      quotationId: run.quotation_id,
      quotationCode,
      sourceRoundId,
      responseDeadlineYmd: deadlineFromDays(plan.response_deadline_days),
    })

    if (!opened.ok) return { ok: false, message: opened.message }

    await assignPendingCounterOffersToRound(db, {
      companyId,
      runId: run.id,
      roundId: opened.roundId,
    })

    roundsOpened += 1
    currentRoundId = opened.roundId
    currentRoundNumber = opened.roundNumber
    nextStatus = "waiting_deadline"
    const openMessage = `Rodada ${opened.roundNumber} aberta. Aguardando respostas dos fornecedores.`
    message = openMessage

    await logNegotiationDecision(db, {
      companyId,
      planId: plan.id,
      runId: run.id,
      roundId: opened.roundId,
      decisionType: options?.forceApprove ? "buyer" : "ai",
      action: "open_round",
      reason: message,
      payload: { round_number: opened.roundNumber, ai_summary: message },
      createdBy: options?.actorUserId ?? null,
    })
  }

  const updated = await updateRun(db, run.id, companyId, {
    status: nextStatus,
    current_round_id: currentRoundId,
    current_round_number: currentRoundNumber,
    rounds_opened: roundsOpened,
    metrics: runMetrics,
    last_tick_at: now,
    started_at: run.started_at ?? now,
  })

  return { ok: true, run: updated, message }
}

async function evaluateStopCriteria(
  db: SupabaseClient,
  companyId: string,
  plan: NegotiationPlan,
  roundsClosedInRun: number,
): Promise<{ stop: boolean; reason: string }> {
  if (roundsClosedInRun >= plan.max_rounds) {
    return {
      stop: true,
      reason: `Negociação concluída: número máximo de rodadas (${plan.max_rounds}) atingido neste evento.`,
    }
  }

  if (roundsClosedInRun < plan.min_rounds) {
    return { stop: false, reason: "" }
  }

  if (plan.stop_on_target) {
    const targetMet = await checkTargetPricesMet(db, companyId, plan.quotation_id, plan)
    if (targetMet) {
      return {
        stop: true,
        reason:
          "Negociação concluída: preço alvo / saving configurado foi atingido nas propostas atuais.",
      }
    }
  }

  return { stop: false, reason: "" }
}

async function describeContinueReason(
  db: SupabaseClient,
  companyId: string,
  plan: NegotiationPlan,
  roundsClosedInRun: number,
): Promise<string> {
  const parts: string[] = []

  if (roundsClosedInRun < plan.min_rounds) {
    parts.push(
      `mínimo de ${plan.min_rounds} rodada(s) ainda não atingido (${roundsClosedInRun} concluída(s) neste evento)`,
    )
  }

  if (plan.stop_on_target) {
    const targetMet = await checkTargetPricesMet(db, companyId, plan.quotation_id, plan)
    if (!targetMet) {
      parts.push("preço alvo e/ou saving projetado ainda não atingido")
    }
  }

  if (roundsClosedInRun >= plan.max_rounds) {
    return "Critérios de parada atingidos. Não há nova rodada a abrir."
  }

  const detail =
    parts.length > 0
      ? parts.join("; ")
      : "ainda há margem para melhoria nas propostas"

  return `A IA identificou que ${detail}. Iniciando próxima rodada de negociação.`
}

async function checkTargetPricesMet(
  db: SupabaseClient,
  companyId: string,
  quotationId: string,
  plan: NegotiationPlan,
): Promise<boolean> {
  const { data: items } = await db
    .from("quotation_items")
    .select("id, target_price")
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)

  const withTarget = (items ?? []).filter(
    (i) => i.target_price != null && Number(i.target_price) > 0,
  )
  if (withTarget.length === 0) return false

  const { data: proposals } = await db
    .from("quotation_proposals")
    .select("id, round_id, status")
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)
    .in("status", ["submitted", "selected"])

  if (!proposals?.length) return false

  const proposalIds = proposals.map((p) => p.id)
  const { data: proposalItems } = await db
    .from("proposal_items")
    .select("quotation_item_id, unit_price, proposal_id")
    .in("proposal_id", proposalIds)

  const bestByItem = new Map<string, number>()
  for (const pi of proposalItems ?? []) {
    const qid = String(pi.quotation_item_id)
    const price = Number(pi.unit_price)
    if (!Number.isFinite(price)) continue
    const prev = bestByItem.get(qid)
    if (prev == null || price < prev) bestByItem.set(qid, price)
  }

  const savingThreshold = 1 - plan.target_saving_pct_below_target / 100

  for (const item of withTarget) {
    const target = Number(item.target_price)
    const best = bestByItem.get(String(item.id))
    if (best == null) return false
    const maxAcceptable = target * savingThreshold
    if (best > maxAcceptable) return false
  }

  return true
}

async function resolveRoundForNegotiationStart(
  db: SupabaseClient,
  companyId: string,
  plan: NegotiationPlan,
): Promise<
  | { ok: true; round: { id: string; round_number: number }; initialStatus: NegotiationRunStatus }
  | { ok: false; message: string }
> {
  const quotationId = plan.quotation_id

  const { data: quotation, error: qErr } = await db
    .from("quotations")
    .select("id, code, status, response_deadline")
    .eq("id", quotationId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (qErr || !quotation) {
    return { ok: false, message: "Cotação não encontrada." }
  }

  if (quotation.status === "completed" || quotation.status === "cancelled") {
    return { ok: false, message: "Cotação encerrada." }
  }

  const { count: supplierCount, error: supCountErr } = await db
    .from("quotation_suppliers")
    .select("id", { count: "exact", head: true })
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)

  if (supCountErr) return { ok: false, message: supCountErr.message }
  if (!supplierCount || supplierCount === 0) {
    return { ok: false, message: "Inclua ao menos um fornecedor na cotação." }
  }

  const activeRound = await findActiveRound(db, companyId, quotationId)
  if (activeRound) {
    return {
      ok: true,
      round: activeRound,
      initialStatus: "waiting_deadline",
    }
  }

  const { data: latestRound, error: latestErr } = await db
    .from("quotation_rounds")
    .select("id, round_number, status")
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestErr) return { ok: false, message: latestErr.message }

  if (!latestRound) {
    const deadlineYmd =
      (quotation.response_deadline as string | null) ??
      deadlineFromDays(plan.response_deadline_days)

    const boot = await ensureInitialQuotationRound(db, {
      companyId,
      quotationId,
      responseDeadlineYmd: deadlineYmd,
    })
    if (!boot.ok) return { ok: false, message: boot.message }

    if (quotation.status === "draft" || quotation.status === "rejected") {
      const { error: pubErr } = await db
        .from("quotations")
        .update({ status: "waiting" })
        .eq("id", quotationId)
        .eq("company_id", companyId)
      if (pubErr) return { ok: false, message: pubErr.message }
    }

    return {
      ok: true,
      round: { id: boot.roundId, round_number: boot.roundNumber },
      initialStatus: "waiting_deadline",
    }
  }

  if (latestRound.status === "closed") {
    await db
      .from("quotations")
      .update({ status: "analysis" })
      .eq("id", quotationId)
      .eq("company_id", companyId)
      .in("status", ["waiting", "draft", "rejected"])

    return {
      ok: true,
      round: {
        id: String(latestRound.id),
        round_number: Number(latestRound.round_number) || 1,
      },
      initialStatus: "analyzing",
    }
  }

  return {
    ok: false,
    message: "Não foi possível identificar uma rodada válida para iniciar a negociação.",
  }
}

async function findActiveRound(
  db: SupabaseClient,
  companyId: string,
  quotationId: string,
): Promise<{ id: string; round_number: number } | null> {
  const { data } = await db
    .from("quotation_rounds")
    .select("id, round_number")
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return { id: String(data.id), round_number: Number(data.round_number) }
}

async function findLatestRoundId(
  db: SupabaseClient,
  companyId: string,
  quotationId: string,
): Promise<string | null> {
  const { data } = await db
    .from("quotation_rounds")
    .select("id")
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ? String(data.id) : null
}

async function updateRun(
  db: SupabaseClient,
  runId: string,
  companyId: string,
  patch: Record<string, unknown>,
): Promise<NegotiationRun> {
  const { data, error } = await db
    .from("quotation_negotiation_runs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("company_id", companyId)
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "Falha ao atualizar execução.")
  return data as NegotiationRun
}

async function completeRun(
  db: SupabaseClient,
  companyId: string,
  plan: NegotiationPlan,
  run: NegotiationRun,
  reason: string,
  actorUserId?: string,
  metrics?: RunMetrics,
): Promise<NegotiationRun> {
  const now = new Date().toISOString()
  const { data, error } = await db
    .from("quotation_negotiation_runs")
    .update({
      status: "completed",
      completed_at: now,
      last_tick_at: now,
      updated_at: now,
      metrics: metrics ?? run.metrics,
    })
    .eq("id", run.id)
    .eq("company_id", companyId)
    .select("*")
    .single()

  await db
    .from("quotation_negotiation_plans")
    .update({ status: "completed", completed_at: now, updated_at: now })
    .eq("id", plan.id)
    .eq("company_id", companyId)

  await logNegotiationDecision(db, {
    companyId,
    planId: plan.id,
    runId: run.id,
    decisionType: "ai",
    action: "complete",
    reason,
    createdBy: actorUserId ?? null,
  })

  if (error || !data) throw new Error(error?.message ?? "Falha ao concluir execução.")
  return data as NegotiationRun
}

export async function startNegotiationRun(
  db: SupabaseClient,
  companyId: string,
  planId: string,
  actorUserId: string,
): Promise<
  | { ok: true; run: NegotiationRun; message: string }
  | { ok: false; message: string }
> {
  const { data: plan, error: planErr } = await db
    .from("quotation_negotiation_plans")
    .select("*")
    .eq("id", planId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (planErr || !plan) return { ok: false, message: "Plano não encontrado." }
  const planRow = plan as NegotiationPlan

  if (planRow.status === "completed" || planRow.status === "cancelled") {
    return { ok: false, message: "Plano já encerrado." }
  }

  const { data: existingRuns } = await db
    .from("quotation_negotiation_runs")
    .select("id, status")
    .eq("plan_id", planId)
    .eq("company_id", companyId)
    .in("status", [
      "pending",
      "running",
      "waiting_deadline",
      "analyzing",
      "opening_round",
      "paused",
      "awaiting_approval",
    ])
    .limit(1)

  if (existingRuns && existingRuns.length > 0) {
    return { ok: false, message: "Já existe uma execução ativa para este plano." }
  }

  const { data: quotationRuns } = await db
    .from("quotation_negotiation_runs")
    .select("id")
    .eq("quotation_id", planRow.quotation_id)
    .eq("company_id", companyId)
    .in("status", [
      "pending",
      "running",
      "waiting_deadline",
      "analyzing",
      "opening_round",
      "paused",
      "awaiting_approval",
    ])
    .limit(1)

  if (quotationRuns && quotationRuns.length > 0) {
    return {
      ok: false,
      message:
        "Já existe um evento de negociação em andamento nesta cotação. Encerre o evento atual antes de iniciar outro.",
    }
  }

  const resolved = await resolveRoundForNegotiationStart(db, companyId, planRow)
  if (!resolved.ok) {
    return { ok: false, message: resolved.message }
  }

  const activeRound = resolved.round
  const initialStatus = resolved.initialStatus
  const initialMetrics: RunMetrics = {
    start_round_number: activeRound.round_number,
    rounds_closed_in_run: initialStatus === "analyzing" ? 1 : 0,
  }

  const now = new Date().toISOString()
  const { data: run, error: runErr } = await db
    .from("quotation_negotiation_runs")
    .insert({
      company_id: companyId,
      plan_id: planId,
      quotation_id: planRow.quotation_id,
      status: initialStatus,
      current_round_id: activeRound.id,
      current_round_number: activeRound.round_number,
      rounds_opened: activeRound.round_number,
      metrics: initialMetrics,
      started_at: now,
      last_tick_at: now,
    })
    .select("*")
    .single()

  if (runErr || !run) {
    return { ok: false, message: runErr?.message ?? "Falha ao iniciar execução." }
  }

  await db
    .from("quotation_negotiation_plans")
    .update({ status: "active", started_at: now, updated_at: now })
    .eq("id", planId)
    .eq("company_id", companyId)

  await logNegotiationDecision(db, {
    companyId,
    planId,
    runId: String(run.id),
    roundId: activeRound.id,
    decisionType: "buyer",
    action: "start_run",
    reason: "Comprador iniciou negociação assistida.",
    createdBy: actorUserId,
  })

  let finalRun = run as NegotiationRun
  let message = "Negociação assistida iniciada."

  if (initialStatus === "analyzing" || initialStatus === "waiting_deadline") {
    const tick = await advanceNegotiationRun(db, companyId, String(run.id), {
      actorUserId,
    })
    if (tick.ok) {
      finalRun = tick.run
      message = tick.message
    }
  }

  return { ok: true, run: finalRun, message }
}

export async function cancelNegotiationRun(
  db: SupabaseClient,
  companyId: string,
  runId: string,
  actorUserId: string,
  reason?: string,
): Promise<
  | { ok: true; run: NegotiationRun }
  | { ok: false; message: string }
> {
  const { data: runRow, error: runErr } = await db
    .from("quotation_negotiation_runs")
    .select("*")
    .eq("id", runId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (runErr || !runRow) {
    return { ok: false, message: "Execução não encontrada." }
  }

  const run = runRow as NegotiationRun
  if (run.status === "completed" || run.status === "cancelled" || run.status === "failed") {
    return { ok: false, message: `Execução já encerrada (${run.status}).` }
  }

  const now = new Date().toISOString()
  const cancelReason =
    reason?.trim() || "Comprador encerrou o evento de negociação assistida."

  const { data: updated, error: updateErr } = await db
    .from("quotation_negotiation_runs")
    .update({
      status: "cancelled",
      completed_at: now,
      last_tick_at: now,
      updated_at: now,
    })
    .eq("id", runId)
    .eq("company_id", companyId)
    .select("*")
    .single()

  if (updateErr || !updated) {
    return { ok: false, message: updateErr?.message ?? "Não foi possível encerrar a execução." }
  }

  await db
    .from("quotation_negotiation_plans")
    .update({ status: "cancelled", completed_at: now, updated_at: now })
    .eq("id", run.plan_id)
    .eq("company_id", companyId)
    .in("status", ["draft", "active", "paused"])

  await logNegotiationDecision(db, {
    companyId,
    planId: run.plan_id,
    runId,
    roundId: run.current_round_id,
    decisionType: "buyer",
    action: "cancel",
    reason: cancelReason,
    createdBy: actorUserId,
  })

  return { ok: true, run: updated as NegotiationRun }
}
