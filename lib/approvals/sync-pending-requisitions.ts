import type { SupabaseClient } from "@supabase/supabase-js"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"

export type SyncPendingApprovalsResult = {
  created: number
  removedOrphans: number
  removedDupes: number
}

async function resolveApprover(
  service: SupabaseClient,
  companyId: string,
  costCenter: string | null,
): Promise<{ approver_id: string | null; approver_name: string | null }> {
  const { data: approverData } = await service.rpc("get_approver_for_requisition", {
    p_company_id: companyId,
    p_cost_center: costCenter ?? "*",
  })
  const row = Array.isArray(approverData) ? approverData[0] : approverData
  return {
    approver_id: (row as { approver_id?: string | null } | null)?.approver_id ?? null,
    approver_name: (row as { approver_name?: string | null } | null)?.approver_name ?? null,
  }
}

/**
 * Reconcilia a fila com o status atual das requisições (fonte da verdade = REQ.status):
 * - remove pending órfãos (REQ não está mais pending)
 * - remove duplicatas pending (mantém o mais recente por entity_id)
 * - cria pending faltante para cada REQ status=pending (mesmo sem regra de CC)
 */
export async function syncPendingRequisitionApprovals(
  service: SupabaseClient,
  companyId: string,
): Promise<SyncPendingApprovalsResult> {
  const enabled = await isTenantFeatureEnabled(companyId, "approval_requisition")
  if (!enabled) {
    return { created: 0, removedOrphans: 0, removedDupes: 0 }
  }

  const [{ data: pendingReqs }, { data: openRequests }] = await Promise.all([
    service
      .from("requisitions")
      .select("id, cost_center")
      .eq("company_id", companyId)
      .eq("status", "pending"),
    service
      .from("approval_requests")
      .select("id, entity_id, created_at")
      .eq("company_id", companyId)
      .eq("flow", "requisition")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ])

  const pendingReqIds = new Set((pendingReqs ?? []).map((r) => r.id as string))
  const open = openRequests ?? []

  // 1) Órfãos: AR pending cuja REQ não está pending
  const orphanIds = open
    .filter((ar) => !pendingReqIds.has(ar.entity_id as string))
    .map((ar) => ar.id as string)

  let removedOrphans = 0
  if (orphanIds.length > 0) {
    const { error } = await service.from("approval_requests").delete().in("id", orphanIds)
    if (!error) removedOrphans = orphanIds.length
  }

  // 2) Deduplicar: por entity_id, manter o mais recente (lista já ordenada desc)
  const seenEntity = new Set<string>()
  const dupIds: string[] = []
  for (const ar of open) {
    const eid = ar.entity_id as string
    if (!pendingReqIds.has(eid)) continue
    if (orphanIds.includes(ar.id as string)) continue
    if (seenEntity.has(eid)) {
      dupIds.push(ar.id as string)
    } else {
      seenEntity.add(eid)
    }
  }

  let removedDupes = 0
  if (dupIds.length > 0) {
    const { error } = await service.from("approval_requests").delete().in("id", dupIds)
    if (!error) removedDupes = dupIds.length
  }

  // 3) Criar faltantes
  const missing = (pendingReqs ?? []).filter((r) => !seenEntity.has(r.id as string))
  let created = 0
  const chunkSize = 5
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize)
    const rows = await Promise.all(
      chunk.map(async (req) => {
        const approver = await resolveApprover(
          service,
          companyId,
          (req.cost_center as string | null) ?? null,
        )
        return {
          company_id: companyId,
          flow: "requisition" as const,
          entity_id: req.id as string,
          approver_id: approver.approver_id,
          approver_name: approver.approver_name,
          status: "pending" as const,
        }
      }),
    )
    const { error } = await service.from("approval_requests").insert(rows)
    if (!error) created += rows.length
  }

  return { created, removedOrphans, removedDupes }
}
