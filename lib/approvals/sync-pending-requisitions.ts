import type { SupabaseClient } from "@supabase/supabase-js"
import { enqueueRequisitionApprovalIfNeeded } from "@/lib/api/external/approval-service"

/**
 * Garante approval_requests pending para cada requisição status=pending
 * sem fila aberta (seed/legado). Retorna quantos registros foram criados.
 */
export async function syncPendingRequisitionApprovals(
  service: SupabaseClient,
  companyId: string,
): Promise<number> {
  const [{ data: pendingReqs }, { data: openRequests }] = await Promise.all([
    service
      .from("requisitions")
      .select("id, cost_center")
      .eq("company_id", companyId)
      .eq("status", "pending"),
    service
      .from("approval_requests")
      .select("entity_id")
      .eq("company_id", companyId)
      .eq("flow", "requisition")
      .eq("status", "pending"),
  ])

  const withOpen = new Set((openRequests ?? []).map((r) => r.entity_id as string))
  const missing = (pendingReqs ?? []).filter((r) => !withOpen.has(r.id as string))

  let created = 0
  const chunkSize = 5
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map((req) =>
        enqueueRequisitionApprovalIfNeeded(
          service,
          companyId,
          req.id as string,
          (req.cost_center as string | null) ?? null,
        ),
      ),
    )
    created += chunk.length
  }
  return created
}
