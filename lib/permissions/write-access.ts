import type { PermissionKey } from "@/lib/hooks/usePermissions"

export type PermissionChecker = (permission: PermissionKey) => boolean

export function isViewOnly(hasPermission: PermissionChecker): boolean {
  return hasPermission("view_only")
}

/** Permite ação de escrita quando a rule específica está ativa e não há view_only. */
export function canWrite(
  hasPermission: PermissionChecker,
  permission: PermissionKey,
): boolean {
  return hasPermission(permission) && !isViewOnly(hasPermission)
}
