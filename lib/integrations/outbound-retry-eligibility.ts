/** Status do pedido em que um log outbound com HTTP OK ainda permite reenvio (ex.: ERP OK, Valore falhou). */
const RETRYABLE_PO_STATUSES_AFTER_ERP_OK = new Set([
  "processing",
  "integration_error",
  "error",
])

export function isPurchaseOrderCreateLog(log: {
  action: string
  entity: string | null
  entity_id: string | null
}): boolean {
  return (
    log.action === "purchase_order.create" &&
    log.entity === "purchase_orders" &&
    Boolean(log.entity_id)
  )
}

/**
 * Reenvio no monitor só quando ainda há pendência real.
 * ERP 200 + pedido completed no Valore → não reenvia (evita duplicidade no ERP).
 */
export function isOutboundRetryEligible(log: {
  action: string
  entity: string | null
  entity_id: string | null
  success: boolean
  entity_status?: string | null
}): boolean {
  if (!isPurchaseOrderCreateLog(log)) return false

  if (!log.success) return true

  if (log.entity_status === "completed") return false
  if (!log.entity_status) return false

  return RETRYABLE_PO_STATUSES_AFTER_ERP_OK.has(log.entity_status)
}
