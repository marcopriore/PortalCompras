import { dispatchOutboundIntegration } from "@/lib/integrations/dispatch"
import type { OutboundIntegrationAction } from "@/lib/integrations/types"

export type RequisitionOutboundPayload = {
  id: string
  code: string
  external_code: string | null
  title: string
  description: string | null
  status: string
  priority: string | null
  cost_center: string | null
  needed_by: string | null
  requester_name: string | null
  origin: string | null
  approver_name?: string | null
  approved_at?: string | null
  rejection_reason?: string | null
  items: Array<{
    material_code: string | null
    material_description: string
    quantity: number
    unit_of_measure: string | null
    estimated_price: number | null
    commodity_group: string | null
    observations: string | null
  }>
}

export async function dispatchRequisitionOutbound(
  companyId: string,
  action: Extract<
    OutboundIntegrationAction,
    | "requisition.created"
    | "requisition.updated"
    | "requisition.approved"
    | "requisition.rejected"
    | "requisition.cancelled"
  >,
  requisition: RequisitionOutboundPayload,
) {
  return dispatchOutboundIntegration({
    companyId,
    action,
    entity: "requisitions",
    entityId: requisition.id,
    entityCode: requisition.code,
    payload: requisition,
  })
}
