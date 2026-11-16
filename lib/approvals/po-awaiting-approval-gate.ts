/**
 * Espelha o gatilho 086 (`enforce_po_awaiting_approval_gate`):
 * sair de `awaiting_approval` para enviar ao fornecedor exige AR
 * `order`/`catalog_order` aprovado e nenhum pendente.
 *
 * Cancelar ou devolver a rascunho (reprovação da alçada de pedido)
 * não exige AR aprovado.
 */
export function canLeavePurchaseOrderAwaitingApproval(input: {
  nextStatus: string
  hasApprovedOrderAr: boolean
  hasPendingOrderAr: boolean
}): boolean {
  if (input.nextStatus === "awaiting_approval") return true
  if (input.nextStatus === "cancelled" || input.nextStatus === "draft") {
    return true
  }
  return input.hasApprovedOrderAr && !input.hasPendingOrderAr
}

/** Policy 086: INSERT/UPDATE autenticado em approval_requests só com status pending. */
export function isClientWritableApprovalRequestStatus(status: string): boolean {
  return status === "pending"
}
