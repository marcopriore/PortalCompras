/** Ações outbound (Valore → ERP) — HTTP ativo com resposta sucesso/falha do ERP */
export const OUTBOUND_INTEGRATION_ACTIONS = [
  "purchase_order.create",
  "purchase_order.update",
  "purchase_order.delete",
  "contract.create",
  "requisition.created",
  "requisition.updated",
  "requisition.approved",
  "requisition.rejected",
  "requisition.cancelled",
] as const

export type OutboundIntegrationAction = (typeof OUTBOUND_INTEGRATION_ACTIONS)[number]

export function isOutboundIntegrationAction(
  value: string,
): value is OutboundIntegrationAction {
  return (OUTBOUND_INTEGRATION_ACTIONS as readonly string[]).includes(value)
}

export type IntegrationEndpointAuthType =
  | "none"
  | "bearer"
  | "basic"
  | "api_key_header"

export type IntegrationEndpointRow = {
  id: string
  company_id: string
  name: string
  base_url: string
  auth_type: IntegrationEndpointAuthType
  auth_config: Record<string, string>
  actions: string[]
  active: boolean
  timeout_ms: number
}

export type OutboundDispatchResult = {
  success: boolean
  responseStatus: number | null
  responseBody: string | null
  errorMessage: string | null
  externalCode?: string | null
}
