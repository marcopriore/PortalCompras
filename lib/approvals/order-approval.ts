import type { SupabaseClient } from "@supabase/supabase-js"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"

export type OrderApproverMatch = {
  approver_id: string
  approver_name: string | null
  level_id: string
}

type ApprovalLevelRow = {
  id: string
  approver_id: string | null
  approver_name: string | null
  min_value: number | null
  max_value: number | null
  created_at?: string | null
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
  const enabled = await isTenantFeatureEnabled(companyId, "approval_order")
  if (!enabled) return { queued: false, reason: "module_off" }

  const { data, error } = await service
    .from("approval_levels")
    .select("id, approver_id, approver_name, min_value, max_value, created_at")
    .eq("company_id", companyId)
    .eq("flow", "order")

  if (error) return { queued: false, error: error.message }

  const match = matchOrderApprovalLevel(
    (data ?? []) as ApprovalLevelRow[],
    totalPrice,
  )
  if (!match) return { queued: false, reason: "no_match" }

  const { error: insertErr } = await service.from("approval_requests").insert({
    company_id: companyId,
    flow: "order",
    entity_id: purchaseOrderId,
    approver_id: match.approver_id,
    approver_name: match.approver_name,
    status: "pending",
  })

  if (insertErr) return { queued: false, error: insertErr.message }

  return { queued: true, approver: match }
}
