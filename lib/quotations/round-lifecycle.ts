import type { SupabaseClient } from "@supabase/supabase-js"
import { createNotification } from "@/lib/notify"
import { templateNewRound } from "@/lib/email/templates"
import { sendEmail } from "@/lib/email/send-email"

type ProposalRow = {
  supplier_id: string | null
  supplier_name: string | null
  supplier_cnpj: string | null
  total_price: number | null
  delivery_days: number | null
  payment_condition: string | null
  validity_date: string | null
  observations: string | null
}

export type OpenRoundParams = {
  companyId: string
  quotationId: string
  quotationCode: string
  sourceRoundId: string
  responseDeadlineYmd: string
  notifySuppliers?: boolean
}

export type OpenRoundResult =
  | { ok: true; roundId: string; roundNumber: number }
  | { ok: false; message: string }

export type CloseRoundParams = {
  companyId: string
  quotationId: string
  roundId: string
  setQuotationAnalysis?: boolean
}

export type CloseRoundResult = { ok: true } | { ok: false; message: string }

/** Prazo YYYY-MM-DD = hoje + N dias (calendário local). */
export function deadlineFromDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function tomorrowDeadlineMin(): string {
  return deadlineFromDays(1)
}

export async function closeQuotationRound(
  db: SupabaseClient,
  params: CloseRoundParams,
): Promise<CloseRoundResult> {
  const now = new Date().toISOString()
  const { error: roundErr } = await db
    .from("quotation_rounds")
    .update({ status: "closed", closed_at: now })
    .eq("id", params.roundId)
    .eq("company_id", params.companyId)

  if (roundErr) return { ok: false, message: roundErr.message }

  if (params.setQuotationAnalysis !== false) {
    const { error: qErr } = await db
      .from("quotations")
      .update({ status: "analysis" })
      .eq("id", params.quotationId)
      .eq("company_id", params.companyId)
    if (qErr) return { ok: false, message: qErr.message }
  }

  return { ok: true }
}

export async function openQuotationRound(
  db: SupabaseClient,
  params: OpenRoundParams,
): Promise<OpenRoundResult> {
  const minD = tomorrowDeadlineMin()
  if (!params.responseDeadlineYmd || params.responseDeadlineYmd < minD) {
    return { ok: false, message: "Prazo de resposta deve ser a partir de amanhã." }
  }

  const { data: rounds, error: roundsErr } = await db
    .from("quotation_rounds")
    .select("round_number")
    .eq("quotation_id", params.quotationId)
    .eq("company_id", params.companyId)

  if (roundsErr) return { ok: false, message: roundsErr.message }

  const roundNumbers = (rounds ?? []).map((r) => Number(r.round_number) || 0)
  const newRoundNumber = roundNumbers.length > 0 ? Math.max(...roundNumbers) + 1 : 1

  const { data: newRoundRow, error: insRoundErr } = await db
    .from("quotation_rounds")
    .insert({
      quotation_id: params.quotationId,
      company_id: params.companyId,
      round_number: newRoundNumber,
      status: "active",
      response_deadline: params.responseDeadlineYmd,
    })
    .select("id")
    .single()

  if (insRoundErr || !newRoundRow) {
    return { ok: false, message: insRoundErr?.message ?? "Falha ao criar rodada." }
  }

  const newRoundId = String(newRoundRow.id)

  const { data: prevProposals, error: prevErr } = await db
    .from("quotation_proposals")
    .select(
      "supplier_id, supplier_name, supplier_cnpj, total_price, delivery_days, payment_condition, validity_date, observations",
    )
    .eq("quotation_id", params.quotationId)
    .eq("round_id", params.sourceRoundId)

  if (prevErr) return { ok: false, message: prevErr.message }

  const prevList = (prevProposals ?? []) as ProposalRow[]
  if (prevList.length > 0) {
    const rows = prevList.map((p) => {
      const row: Record<string, unknown> = {
        quotation_id: params.quotationId,
        company_id: params.companyId,
        supplier_name: p.supplier_name,
        supplier_cnpj: p.supplier_cnpj,
        round_id: newRoundId,
        status: "invited",
        total_price: p.total_price,
        delivery_days: p.delivery_days,
        payment_condition: p.payment_condition,
        validity_date: p.validity_date,
        observations: p.observations,
      }
      if (p.supplier_id) row.supplier_id = p.supplier_id
      return row
    })
    const { error: insPErr } = await db.from("quotation_proposals").insert(rows)
    if (insPErr) return { ok: false, message: insPErr.message }
  }

  const { error: waitErr } = await db
    .from("quotations")
    .update({ status: "waiting" })
    .eq("id", params.quotationId)
    .eq("company_id", params.companyId)

  if (waitErr) return { ok: false, message: waitErr.message }

  if (params.notifySuppliers !== false) {
    await notifySuppliersNewRound(db, {
      companyId: params.companyId,
      quotationCode: params.quotationCode,
      roundId: newRoundId,
      roundNumber: newRoundNumber,
      deadlineYmd: params.responseDeadlineYmd,
      proposals: prevList,
    })
  }

  return { ok: true, roundId: newRoundId, roundNumber: newRoundNumber }
}

/**
 * Garante rodada 1 + propostas "invited" para cada fornecedor convidado.
 * Cotações enviadas antes desta correção podem não ter rodada criada.
 */
export async function ensureInitialQuotationRound(
  db: SupabaseClient,
  params: {
    companyId: string
    quotationId: string
    responseDeadlineYmd: string | null
  },
): Promise<
  | { ok: true; roundId: string; roundNumber: number; created: boolean }
  | { ok: false; message: string }
> {
  const { companyId, quotationId, responseDeadlineYmd } = params

  const { data: existingRounds, error: existingErr } = await db
    .from("quotation_rounds")
    .select("id, round_number")
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)
    .order("round_number", { ascending: false })
    .limit(1)

  if (existingErr) return { ok: false, message: existingErr.message }

  if (existingRounds && existingRounds.length > 0) {
    const row = existingRounds[0]
    return {
      ok: true,
      roundId: String(row.id),
      roundNumber: Number(row.round_number) || 1,
      created: false,
    }
  }

  const deadlineYmd = responseDeadlineYmd?.trim() || deadlineFromDays(7)

  const { data: newRound, error: roundErr } = await db
    .from("quotation_rounds")
    .insert({
      quotation_id: quotationId,
      company_id: companyId,
      round_number: 1,
      status: "active",
      response_deadline: deadlineYmd,
    })
    .select("id, round_number")
    .single()

  if (roundErr || !newRound) {
    return { ok: false, message: roundErr?.message ?? "Falha ao criar rodada 1." }
  }

  const roundId = String(newRound.id)

  const { data: suppliers, error: supErr } = await db
    .from("quotation_suppliers")
    .select("supplier_id, supplier_name, supplier_cnpj")
    .eq("quotation_id", quotationId)
    .eq("company_id", companyId)
    .order("position", { ascending: true, nullsFirst: false })

  if (supErr) return { ok: false, message: supErr.message }

  const supplierRows = suppliers ?? []
  if (supplierRows.length > 0) {
    const proposalRows = supplierRows.map((s) => ({
      quotation_id: quotationId,
      company_id: companyId,
      supplier_id: s.supplier_id,
      supplier_name: s.supplier_name,
      supplier_cnpj: s.supplier_cnpj,
      round_id: roundId,
      status: "invited",
    }))
    const { error: propErr } = await db.from("quotation_proposals").insert(proposalRows)
    if (propErr) return { ok: false, message: propErr.message }
  }

  return {
    ok: true,
    roundId,
    roundNumber: Number(newRound.round_number) || 1,
    created: true,
  }
}

async function notifySuppliersNewRound(
  db: SupabaseClient,
  ctx: {
    companyId: string
    quotationCode: string
    roundId: string
    roundNumber: number
    deadlineYmd: string
    proposals: ProposalRow[]
  },
): Promise<void> {
  try {
    const supplierIds = [
      ...new Set(
        ctx.proposals.map((p) => p.supplier_id).filter((id): id is string => Boolean(id)),
      ),
    ]
    if (supplierIds.length === 0) return

    const { data: supplierProfiles } = await db
      .from("profiles")
      .select("id, supplier_id")
      .in("supplier_id", supplierIds)
      .eq("profile_type", "supplier")

    if (!supplierProfiles?.length) return

    const nameBySupplierId = new Map<string, string>()
    for (const p of ctx.proposals) {
      if (p.supplier_id && p.supplier_name) {
        nameBySupplierId.set(p.supplier_id, p.supplier_name)
      }
    }

    await Promise.allSettled(
      supplierProfiles.map((profile) =>
        createNotification({
          userId: profile.id,
          companyId: ctx.companyId,
          type: "quotation.new_round",
          title: "Nova rodada de negociação",
          body: `Uma nova rodada foi aberta na cotação ${ctx.quotationCode}. Envie sua proposta atualizada.`,
          entity: "quotation_rounds",
          entityId: ctx.roundId,
        }),
      ),
    )

    await Promise.allSettled(
      supplierProfiles.map(async (row) => {
        const email = await getUserEmailFromService(db, row.id)
        if (!email) return
        const supplierName =
          (row.supplier_id && nameBySupplierId.get(row.supplier_id)) ?? "Fornecedor"
        const { subject, html } = templateNewRound({
          supplierName,
          quotationCode: ctx.quotationCode,
          roundNumber: ctx.roundNumber,
          deadline: ctx.deadlineYmd,
        })
        await sendEmail({ to: email, subject, html })
      }),
    )
  } catch {
    // notificação não bloqueia abertura de rodada
  }
}

async function getUserEmailFromService(
  db: SupabaseClient,
  userId: string,
): Promise<string | null> {
  try {
    const { data, error } = await db.auth.admin.getUserById(userId)
    if (error || !data.user?.email) return null
    return data.user.email
  } catch {
    return null
  }
}

export async function countSubmittedProposals(
  db: SupabaseClient,
  companyId: string,
  roundId: string,
): Promise<{ invited: number; submitted: number }> {
  const { data, error } = await db
    .from("quotation_proposals")
    .select("status")
    .eq("company_id", companyId)
    .eq("round_id", roundId)

  if (error || !data) return { invited: 0, submitted: 0 }
  const invited = data.length
  const submitted = data.filter((r) => r.status === "submitted").length
  return { invited, submitted }
}

export async function isRoundDeadlinePassed(
  db: SupabaseClient,
  companyId: string,
  roundId: string,
): Promise<boolean> {
  const { data } = await db
    .from("quotation_rounds")
    .select("response_deadline, status")
    .eq("id", roundId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (!data || data.status !== "active") return false
  const deadline = String(data.response_deadline ?? "").trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return false

  const today = deadlineFromDays(0)
  return deadline < today
}
