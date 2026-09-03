import { integrateRequisitionWithErp } from "@/lib/integrations/integrate-requisition-with-erp"
import type { RequisitionIntegrationAction } from "@/lib/integrations/integrate-requisition-with-erp"

/**
 * Disparo Valore → ERP para requisição.
 * Respeita feature api_integrations, erp_integration_enabled e matriz api_capabilities.
 * Fire-and-forget seguro: nunca lança para o caller.
 */
export function triggerRequisitionOutbound(
  companyId: string,
  requisitionId: string,
  action: RequisitionIntegrationAction,
): void {
  void integrateRequisitionWithErp(companyId, requisitionId, action).catch(
    (err: unknown) => {
      console.error(
        "[requisition-outbound]",
        action,
        requisitionId,
        err instanceof Error ? err.message : err,
      )
    },
  )
}
