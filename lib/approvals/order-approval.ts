import type { SupabaseClient } from "@supabase/supabase-js"

export type OrderApproverMatch = {
  approver_id: string
  approver_name: string | null
  level_id: string
}

export type ApprovalLevelRow = {
  id: string
  approver_id: string | null
  approver_name: string | null
  min_value: number | null
  max_value: number | null
  created_at?: string | null
}

export type OrderConfirmPlan =
  | { ok: true; nextStatus: "sent"; reason: "module_off" | "no_match" }
  | { ok: true; nextStatus: "awaiting_approval"; match: OrderApproverMatch }
  | { ok: false; error: string }

/**
 * Decide se o Confirmar Pedido vai para o fornecedor ou para alçada.
 * Falha fechada: erro ao ler o módulo/alçadas NÃO envia o pedido.
 */
export function planOrderConfirmStatus(input: {
  moduleLookupFailed: boolean
  moduleEnabled: boolean
  levelsLookupFailed: boolean
  levels: ApprovalLevelRow[]
  totalPrice: number
}): OrderConfirmPlan {
  if (input.moduleLookupFailed) {
    return {
      ok: false,
      error: "Não foi possível verificar a alçada de pedido.",
    }
  }
  if (!input.moduleEnabled) {
    return { ok: true, nextStatus: "sent", reason: "module_off" }
  }
  if (input.levelsLookupFailed) {
    return {
      ok: false,
      error: "Não foi possível carregar as alçadas de pedido.",
    }
  }
  const match = matchOrderApprovalLevel(input.levels, input.totalPrice)
  if (!match) return { ok: true, nextStatus: "sent", reason: "no_match" }
  return { ok: true, nextStatus: "awaiting_approval", match }
}

/** Lê o módulo e as alçadas no momento do clique — não usa flag async da UI. */
export async function resolveOrderConfirmPlan(
  db: SupabaseClient,
  companyId: string,
  totalPrice: number,
): Promise<OrderConfirmPlan> {
  const featureRes = await db
    .from("tenant_features")
    .select("enabled")
    .eq("company_id", companyId)
    .eq("feature_key", "approval_order")
    .maybeSingle()

  if (featureRes.error) {
    return planOrderConfirmStatus({
      moduleLookupFailed: true,
      moduleEnabled: false,
      levelsLookupFailed: false,
      levels: [],
      totalPrice,
    })
  }

  const moduleEnabled = Boolean(
    (featureRes.data as { enabled?: boolean } | null)?.enabled,
  )
  if (!moduleEnabled) {
    return planOrderConfirmStatus({
      moduleLookupFailed: false,
      moduleEnabled: false,
      levelsLookupFailed: false,
      levels: [],
      totalPrice,
    })
  }

  const levelsRes = await db
    .from("approval_levels")
    .select("id, approver_id, approver_name, min_value, max_value, created_at")
    .eq("company_id", companyId)
    .eq("flow", "order")

  return planOrderConfirmStatus({
    moduleLookupFailed: false,
    moduleEnabled: true,
    levelsLookupFailed: Boolean(levelsRes.error),
    levels: (levelsRes.data ?? []) as ApprovalLevelRow[],
    totalPrice,
  })
}

/** Alçada de Pedido: só por valor (category ignorada / sempre "*"). */
export function matchOrderApprovalLevel(
  levels: ApprovalLevelRow[],
  totalPrice: number,
): OrderApproverMatch | null {
  const total = Number(totalPrice)
  if (!Number.isFinite(total)) return null

  const matches = levels.filter((level) => {
    if (!level.approver_id) return false
    const min = level.min_value != null ? Number(level.min_value) : 0
    const max = level.max_value != null ? Number(level.max_value) : null
    if (!Number.isFinite(min)) return false
    if (total < min) return false
    if (max != null && Number.isFinite(max) && total > max) return false
    return true
  })

  if (matches.length === 0) return null

  // Preferir faixa mais específica (maior min_value); empate → mais antiga
  matches.sort((a, b) => {
    const minA = a.min_value != null ? Number(a.min_value) : 0
    const minB = b.min_value != null ? Number(b.min_value) : 0
    if (minB !== minA) return minB - minA
    const tA = a.created_at ? Date.parse(a.created_at) : 0
    const tB = b.created_at ? Date.parse(b.created_at) : 0
    return tA - tB
  })

  const best = matches[0]
  return {
    level_id: best.id,
    approver_id: best.approver_id as string,
    approver_name: best.approver_name,
  }
}

/**
 * Se o módulo estiver ligado e houver alçada de valor, cria AR `order`.
 * Retorna `queued: false` quando deve seguir direto para o fornecedor.
 */
export async function enqueueOrderApprovalIfNeeded(
  service: SupabaseClient,
  companyId: string,
  purchaseOrderId: string,
  totalPrice: number,
): Promise<
  | { queued: true; approver: OrderApproverMatch }
  | { queued: false; reason: "module_off" | "no_match" }
  | { queued: false; error: string }
> {
  const plan = await resolveOrderConfirmPlan(service, companyId, totalPrice)
  if (!plan.ok) return { queued: false, error: plan.error }
  if (plan.nextStatus === "sent") {
    return { queued: false, reason: plan.reason }
  }

  const { error: insertErr } = await service.from("approval_requests").insert({
    company_id: companyId,
    flow: "order",
    entity_id: purchaseOrderId,
    approver_id: plan.match.approver_id,
    approver_name: plan.match.approver_name,
    status: "pending",
  })

  if (insertErr) return { queued: false, error: insertErr.message }

  return { queued: true, approver: plan.match }
}
