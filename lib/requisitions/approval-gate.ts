/**
 * Espelha o gatilho SQL `trg_enforce_requisition_approval_gate` (migration 085).
 * Quem pode avançar REQ `pending`/`rejected` no cliente (JWT do usuário):
 * - permanecer `pending` / ir para `cancelled`
 * - ir para `approved` só se a alçada de requisição não se aplica
 * Aprovações reais (gestor) passam pelo service role (`auth.uid()` nulo) e não usam esta regra.
 */
export function clientMayChangeRequisitionStatus(input: {
  oldStatus: string
  newStatus: string
  isServiceRole: boolean
  requiresManualApproval: boolean
}): boolean {
  if (input.isServiceRole) return true
  if (input.oldStatus === input.newStatus) return true
  if (input.oldStatus !== "pending" && input.oldStatus !== "rejected") return true
  if (input.newStatus === "pending" || input.newStatus === "cancelled") return true
  if (input.newStatus === "approved" && !input.requiresManualApproval) return true
  return false
}

/** Feature `approval_requisition` ligada e há aprovador para o CC. */
export function requisitionRequiresManualApproval(
  approvalModuleEnabled: boolean,
  hasApprover: boolean,
): boolean {
  return Boolean(approvalModuleEnabled && hasApprover)
}
