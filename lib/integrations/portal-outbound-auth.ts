import type { RequisitionIntegrationAction } from "@/lib/integrations/integrate-requisition-with-erp"
import { isRequisitionIntegrationAction } from "@/lib/integrations/integrate-requisition-with-erp"

export type PortalOutboundActor = {
  userId: string
  profileType: string | null | undefined
  isSuperAdmin: boolean
}

const REQUESTER_PORTAL_ACTIONS = new Set<RequisitionIntegrationAction>([
  "requisition.created",
  "requisition.cancelled",
])

/**
 * Portal (`source !== "monitor"`) só pode disparar outbound de requisição.
 * Pedido/contrato exigem o monitor (integration.monitor) ou as rotas dedicadas.
 */
export function authorizePortalOutboundAction(params: {
  action: string
  actor: PortalOutboundActor
  requisitionRequesterId?: string | null
}): { ok: true } | { ok: false; error: string; status: 403 } {
  if (!isRequisitionIntegrationAction(params.action)) {
    return {
      ok: false,
      error: "Ação outbound não permitida pelo portal.",
      status: 403,
    }
  }

  if (params.actor.isSuperAdmin || params.actor.profileType === "buyer") {
    return { ok: true }
  }

  if (params.actor.profileType === "requester") {
    if (!REQUESTER_PORTAL_ACTIONS.has(params.action)) {
      return { ok: false, error: "Forbidden", status: 403 }
    }
    if (
      !params.requisitionRequesterId ||
      params.requisitionRequesterId !== params.actor.userId
    ) {
      return { ok: false, error: "Forbidden", status: 403 }
    }
    return { ok: true }
  }

  return { ok: false, error: "Forbidden", status: 403 }
}
