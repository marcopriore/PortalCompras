import type { PermissionKey } from "@/lib/hooks/usePermissions"
import {
  canUserWrite,
  hasUserPermission,
} from "@/lib/permissions/resolve-user-permissions"

export type ApprovalDecideFlow = "requisition" | "order" | "catalog_order"

export function approvalPermissionForFlow(
  flow: string,
): PermissionKey | null {
  if (flow === "requisition") return "approval.requisition"
  if (flow === "order") return "approval.order"
  if (flow === "catalog_order") return "approval.catalog_order"
  return null
}

/**
 * Portal decide gate — mirrors EntityApprovalActions:
 * flow write permission + (assigned approver or approval.view_all).
 * Superadmin bypasses. view_only blocks writes.
 */
export function canPortalUserDecideApproval(params: {
  isSuperAdmin: boolean
  userId: string
  approverId: string | null | undefined
  flow: string
  permissions: Set<PermissionKey>
}): { ok: true } | { ok: false; reason: string } {
  if (params.isSuperAdmin) return { ok: true }

  const flowPermission = approvalPermissionForFlow(params.flow)
  if (!flowPermission) {
    return { ok: false, reason: "Fluxo de aprovação inválido." }
  }

  if (!canUserWrite(params.permissions, flowPermission)) {
    return {
      ok: false,
      reason: "Você não tem permissão para decidir esta aprovação.",
    }
  }

  const canViewAll = hasUserPermission(params.permissions, "approval.view_all")
  if (!canViewAll && params.approverId !== params.userId) {
    return {
      ok: false,
      reason: "Esta aprovação está atribuída a outro usuário.",
    }
  }

  return { ok: true }
}
