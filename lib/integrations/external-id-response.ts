import type { OutboundIntegrationAction } from "@/lib/integrations/types"

/**
 * Campos aceitos na resposta HTTP do ERP para o ID externo, por ação/entidade.
 * A ordem importa: a primeira chave encontrada no JSON é usada.
 * `external_code` permanece como fallback legado para pedidos e requisições.
 */
export const ERP_RESPONSE_EXTERNAL_ID_KEYS: Partial<
  Record<OutboundIntegrationAction, readonly string[]>
> = {
  "purchase_order.create": ["external_purchase_order_id", "external_code"],
  "purchase_order.update": ["external_purchase_order_id", "external_code"],
  "contract.create": ["external_contract_id", "external_code"],
  "requisition.created": ["external_requisition_id", "external_code"],
  "requisition.updated": ["external_requisition_id", "external_code"],
  "requisition.approved": ["external_requisition_id", "external_code"],
  "requisition.rejected": ["external_requisition_id", "external_code"],
  "requisition.cancelled": ["external_requisition_id", "external_code"],
}

export function parseExternalIdFromErpResponse(
  action: OutboundIntegrationAction,
  responseBody: string,
): string | null {
  try {
    const parsed = JSON.parse(responseBody) as Record<string, unknown>
    const keys = ERP_RESPONSE_EXTERNAL_ID_KEYS[action] ?? ["external_code"]

    for (const key of keys) {
      const value = parsed[key]
      if (typeof value === "string" && value.trim()) {
        return value.trim()
      }
    }
  } catch {
    // corpo não-JSON aceito se HTTP 2xx sem ID externo
  }

  return null
}
