import type { SupabaseClient } from "@supabase/supabase-js"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"

export type CatalogOrderCreated = {
  id: string
  code: string
}

/**
 * Enfileira aprovação `catalog_order` (1 AR por PO) após checkout em modo
 * cost_center_approval. Falha se módulo/alçada ausentes.
 */
export async function enqueueCatalogOrderApprovals(
  service: SupabaseClient,
  companyId: string,
  costCenter: string,
  purchaseOrders: CatalogOrderCreated[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const enabled = await isTenantFeatureEnabled(companyId, "approval_catalog_order")
  if (!enabled) {
    return {
      ok: false,
      error:
        "Modo Pendente Aprovação exige o módulo Aprovação Pedido — Catálogo habilitado.",
    }
  }

  const { data: approverData, error: rpcErr } = await service.rpc(
    "get_approver_for_catalog_order",
    {
      p_company_id: companyId,
      p_cost_center: costCenter.trim() || "*",
    },
  )

  if (rpcErr) {
    return { ok: false, error: rpcErr.message }
  }

  const approver = Array.isArray(approverData) ? approverData[0] : approverData
  if (!approver?.approver_id) {
    return {
      ok: false,
      error: `Nenhuma alçada de Pedido — Catálogo para o centro de custo "${costCenter.trim()}". Configure em Configurações → Aprovações.`,
    }
  }

  const rows = purchaseOrders.map((po) => ({
    company_id: companyId,
    flow: "catalog_order",
    entity_id: po.id,
    approver_id: approver.approver_id as string,
    approver_name: (approver.approver_name as string | null) ?? null,
    status: "pending",
  }))

  const { error: insertErr } = await service.from("approval_requests").insert(rows)
  if (insertErr) {
    return { ok: false, error: insertErr.message }
  }

  return { ok: true }
}
