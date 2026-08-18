import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { isTenantFeatureEnabled } from "@/lib/api/external/check-tenant-feature"
import {
  mapPurchaseOrderToApi,
  type PurchaseOrderItemRow,
} from "@/lib/api/external/mappers/purchase-order"
import {
  mapRequisitionToApi,
  type RequisitionItemRow,
} from "@/lib/api/external/mappers/requisition"
import { dispatchOutboundIntegration } from "@/lib/integrations/dispatch"
import type { OutboundIntegrationAction } from "@/lib/integrations/types"
import type { RequisitionOutboundPayload } from "@/lib/integrations/requisition-outbound"

export async function loadRequisitionOutboundPayload(
  companyId: string,
  requisitionId: string,
): Promise<RequisitionOutboundPayload | null> {
  const service = createServiceRoleClient()
  const { data: row } = await service
    .from("requisitions")
    .select("*")
    .eq("id", requisitionId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (!row) return null

  const { data: items } = await service
    .from("requisition_items")
    .select(
      "id, material_code, material_description, quantity, unit_of_measure, estimated_price, commodity_group, observations",
    )
    .eq("requisition_id", requisitionId)
    .order("created_at", { ascending: true })

  const mapped = mapRequisitionToApi(row, (items ?? []) as RequisitionItemRow[])
  return {
    id: mapped.id,
    code: mapped.code,
    external_code: mapped.external_code,
    title: mapped.title,
    description: mapped.description,
    status: mapped.status,
    priority: mapped.priority,
    cost_center: mapped.cost_center,
    needed_by: mapped.needed_by,
    requester_name: mapped.requester_name,
    origin: mapped.origin,
    approver_name: mapped.approver_name,
    approved_at: mapped.approved_at,
    rejection_reason: mapped.rejection_reason,
    items: mapped.items,
  }
}

export async function loadPurchaseOrderOutboundPayload(
  companyId: string,
  orderId: string,
) {
  const service = createServiceRoleClient()
  const { data: row } = await service
    .from("purchase_orders")
    .select("*")
    .eq("id", orderId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (!row) return null

  const { data: items } = await service
    .from("purchase_order_items")
    .select(
      "material_code, material_description, quantity, unit_of_measure, unit_price, total_price, delivery_days",
    )
    .eq("purchase_order_id", orderId)
    .order("material_code", { ascending: true })

  return mapPurchaseOrderToApi(row, (items ?? []) as PurchaseOrderItemRow[])
}

export type TriggerOutboundResult = {
  skipped: boolean
  dispatched: boolean
  success?: boolean
  externalCode?: string | null
  errorMessage?: string | null
}

export async function triggerOutboundIntegration(
  companyId: string,
  action: OutboundIntegrationAction,
  entityId: string,
): Promise<TriggerOutboundResult> {
  const enabled = await isTenantFeatureEnabled(companyId, "api_integrations")
  if (!enabled) {
    return { skipped: true, dispatched: false }
  }

  if (action.startsWith("purchase_order.")) {
    const payload = await loadPurchaseOrderOutboundPayload(companyId, entityId)
    if (!payload) {
      return { skipped: false, dispatched: false, errorMessage: "Pedido não encontrado." }
    }

    const result = await dispatchOutboundIntegration({
      companyId,
      action,
      entity: "purchase_orders",
      entityId,
      entityCode: payload.code,
      payload,
    })

    return {
      skipped: false,
      dispatched: true,
      success: result.success,
      externalCode: result.externalCode ?? null,
      errorMessage: result.errorMessage,
    }
  }

  if (action.startsWith("requisition.")) {
    const payload = await loadRequisitionOutboundPayload(companyId, entityId)
    if (!payload) {
      return { skipped: false, dispatched: false, errorMessage: "Requisição não encontrada." }
    }

    const result = await dispatchOutboundIntegration({
      companyId,
      action,
      entity: "requisitions",
      entityId,
      entityCode: payload.code,
      payload,
    })

    return {
      skipped: false,
      dispatched: true,
      success: result.success,
      errorMessage: result.errorMessage,
    }
  }

  return { skipped: false, dispatched: false, errorMessage: "Ação não suportada." }
}
