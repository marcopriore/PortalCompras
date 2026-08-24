import type { PermissionKey } from "@/lib/hooks/usePermissions"

export type PermissionChecker = (permission: PermissionKey) => boolean

/** Rules que alteram dados ou disparam fluxos de escrita (bloqueadas por view_only). */
export const WRITE_PERMISSION_KEYS: PermissionKey[] = [
  "quotation.create",
  "quotation.edit",
  "quotation.cancel",
  "quotation.delegate",
  "quotation.equalize.select",
  "order.create",
  "order.edit",
  "order.edit_own",
  "order.delegate",
  "contract.create",
  "contract.edit",
  "requisition.create.buyer",
  "requisition.create.requester",
  "requisition.approve",
  "approval.requisition",
  "approval.order",
  "import.excel",
  "supplier.create",
  "supplier.edit",
  "item.create",
  "item.edit",
  "user.manage",
  "user.impersonate",
  "settings.manage",
]

const WRITE_PERMISSION_SET = new Set<string>(WRITE_PERMISSION_KEYS)

export function isWritePermission(permission: PermissionKey): boolean {
  return WRITE_PERMISSION_SET.has(permission)
}

export function isViewOnly(hasPermission: PermissionChecker): boolean {
  return hasPermission("view_only")
}

export function canWritePermission(
  permissions: Record<PermissionKey, boolean>,
  permission: PermissionKey,
): boolean {
  if (!permissions[permission]) return false
  if (permissions.view_only && isWritePermission(permission)) return false
  return true
}

/** Permite ação de escrita quando a rule específica está ativa e não há view_only. */
export function canWrite(
  hasPermission: PermissionChecker,
  permission: PermissionKey,
): boolean {
  if (!hasPermission(permission)) return false
  if (hasPermission("view_only") && isWritePermission(permission)) return false
  return true
}
