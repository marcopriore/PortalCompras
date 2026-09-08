import type { PermissionKey } from "@/lib/hooks/usePermissions"
import { hasUserPermission } from "@/lib/permissions/resolve-user-permissions"

/** Acesso de leitura ao catálogo (menu/itens). */
export function hasCatalogViewAccess(
  hasPermission: (key: PermissionKey) => boolean,
): boolean {
  return (
    hasPermission("catalog.view") ||
    hasPermission("nav.catalog") ||
    hasPermission("catalog.order")
  )
}

export function hasCatalogViewAccessFromKeys(
  permissions: Set<PermissionKey> | Set<string>,
): boolean {
  const keys = permissions as Set<PermissionKey>
  return (
    hasUserPermission(keys, "catalog.view") ||
    hasUserPermission(keys, "nav.catalog") ||
    hasUserPermission(keys, "catalog.order")
  )
}
