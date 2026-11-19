import type { PermissionKey } from "@/lib/hooks/usePermissions"
import {
  canUserWrite,
  hasUserPermission,
} from "@/lib/permissions/resolve-user-permissions"

export const APPROVAL_FLOW_PERMISSION = {
  requisition: "approval.requisition",
  order: "approval.order",
  catalog_order: "approval.catalog_order",
} as const

export type PortalApprovalFlow = keyof typeof APPROVAL_FLOW_PERMISSION

export function isPortalApprovalFlow(flow: string): flow is PortalApprovalFlow {
  return Object.prototype.hasOwnProperty.call(APPROVAL_FLOW_PERMISSION, flow)
}

/**
 * Espelha a UI (`EntityApprovalActions` / fila de aprovações):
 * só o aprovador designado (ou quem tem `approval.view_all` / superadmin)
 * pode decidir, e apenas com a permissão de escrita do fluxo.
 */
export function canDecideApprovalRequest(params: {
  actorUserId: string
  isSuperAdmin: boolean
  permissions: Set<PermissionKey>
  flow: string
  approverId: string | null
}): boolean {
  if (!params.actorUserId) return false
  if (params.isSuperAdmin) return true
  if (!isPortalApprovalFlow(params.flow)) return false

  const flowPermission = APPROVAL_FLOW_PERMISSION[params.flow]
  if (!canUserWrite(params.permissions, flowPermission)) return false

  if (hasUserPermission(params.permissions, "approval.view_all")) return true

  return Boolean(params.approverId && params.approverId === params.actorUserId)
}
