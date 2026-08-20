/** Status do pedido em que um log outbound com HTTP OK ainda permite reenvio (ex.: ERP OK, Valore falhou). */
const RETRYABLE_PO_STATUSES_AFTER_ERP_OK = new Set([
  "processing",
  "integration_error",
  "error",
])

const PURCHASE_ORDER_OUTBOUND_ACTIONS = new Set([
  "purchase_order.create",
  "purchase_order.update",
  "purchase_order.delete",
])

const CONTRACT_OUTBOUND_ACTIONS = new Set(["contract.create"])

export function isContractOutboundLog(log: {
  action: string
  entity: string | null
  entity_id: string | null
}): boolean {
  return (
    log.entity === "contracts" &&
    Boolean(log.entity_id) &&
    CONTRACT_OUTBOUND_ACTIONS.has(log.action)
  )
}

export function isPurchaseOrderOutboundLog(log: {
  action: string
  entity: string | null
  entity_id: string | null
}): boolean {
  return (
    log.entity === "purchase_orders" &&
    Boolean(log.entity_id) &&
    PURCHASE_ORDER_OUTBOUND_ACTIONS.has(log.action)
  )
}

/** @deprecated Use isPurchaseOrderOutboundLog */
export function isPurchaseOrderCreateLog(log: {
  action: string
  entity: string | null
  entity_id: string | null
}): boolean {
  return isPurchaseOrderOutboundLog(log) && log.action === "purchase_order.create"
}

function isPurchaseOrderCreateRetryEligible(log: {
  success: boolean
  entity_status?: string | null
}): boolean {
  if (!log.success) return true
  if (log.entity_status === "completed") return false
  if (!log.entity_status) return false
  return RETRYABLE_PO_STATUSES_AFTER_ERP_OK.has(log.entity_status)
}

function isPurchaseOrderEventRetryEligible(log: {
  success: boolean
  action: string
  entity_status?: string | null
}): boolean {
  if (!log.success) return true
  if (log.action === "purchase_order.delete") {
    return log.entity_status !== "cancelled"
  }
  if (log.action === "purchase_order.update") {
    return RETRYABLE_PO_STATUSES_AFTER_ERP_OK.has(log.entity_status ?? "")
  }
  return false
}

function isContractCreateRetryEligible(log: {
  success: boolean
  entity_external_code?: string | null
}): boolean {
  if (!log.success) return true
  return !log.entity_external_code?.trim()
}

/**
 * Reenvio no monitor só quando ainda há pendência real.
 * ERP 200 + entidade sincronizada no Valore → não reenvia (evita duplicidade no ERP).
 */
export function isOutboundRetryEligible(log: {
  action: string
  entity: string | null
  entity_id: string | null
  success: boolean
  entity_status?: string | null
  entity_external_code?: string | null
  error_message?: string | null
}): boolean {
  if (log.error_message === "Em andamento") return false

  if (isPurchaseOrderOutboundLog(log)) {
    if (log.action === "purchase_order.create") {
      return isPurchaseOrderCreateRetryEligible(log)
    }
    return isPurchaseOrderEventRetryEligible(log)
  }

  if (isContractOutboundLog(log)) {
    if (log.action === "contract.create") {
      return isContractCreateRetryEligible(log)
    }
  }

  return false
}
