import type { SupabaseClient } from "@supabase/supabase-js"
import type { PermissionKey } from "@/lib/hooks/usePermissions"
import { canWritePermission } from "@/lib/permissions/write-access"

function applyKeys(target: Set<PermissionKey>, keys: string[]) {
  for (const key of keys) {
    target.add(key as PermissionKey)
  }
}

export async function loadUserPermissionKeys(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
): Promise<Set<PermissionKey>> {
  const permissions = new Set<PermissionKey>()

  const groupLinksRes = await supabase
    .from("profile_permission_groups")
    .select("group_id")
    .eq("company_id", companyId)
    .eq("user_id", userId)

  if (!groupLinksRes.error) {
    const groupIds = ((groupLinksRes.data ?? []) as { group_id: string }[])
      .map((r) => r.group_id)
      .filter(Boolean)

    if (groupIds.length > 0) {
      const { data: groupRules } = await supabase
        .from("permission_group_rules")
        .select("permission_key")
        .eq("company_id", companyId)
        .in("group_id", groupIds)
        .eq("enabled", true)

      applyKeys(
        permissions,
        ((groupRules ?? []) as { permission_key: string }[]).map((r) => r.permission_key),
      )
    }
  }

  const profilePermissionsRes = await supabase
    .from("profile_permissions")
    .select("permission_key")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("enabled", true)

  applyKeys(
    permissions,
    ((profilePermissionsRes.data ?? []) as { permission_key: string }[]).map(
      (r) => r.permission_key,
    ),
  )

  return permissions
}

export function hasUserPermission(
  permissions: Set<PermissionKey>,
  permission: PermissionKey,
): boolean {
  return permissions.has(permission)
}

export function canUserWrite(
  permissions: Set<PermissionKey>,
  permission: PermissionKey,
): boolean {
  const record = {} as Record<PermissionKey, boolean>
  for (const key of permissions) {
    record[key] = true
  }
  return canWritePermission(record, permission)
}
