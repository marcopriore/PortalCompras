import type { RequisitionIntegrationAction } from "@/lib/integrations/integrate-requisition-with-erp"

/** Client: dispara outbound REQ sem bloquear a UX. */
export function notifyRequisitionOutboundClient(
  requisitionId: string,
  action: RequisitionIntegrationAction,
): void {
  if (!requisitionId) return
  void fetch("/api/integrations/outbound", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      entity_id: requisitionId,
      source: "portal",
    }),
  }).catch(() => {
    // silencioso — gate de capacidade / ERP já trata skip
  })
}
