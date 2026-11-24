import { queryOptions } from "@tanstack/react-query"
import { queryKeys } from "@/lib/queries/keys"

export type PermissionGroupListRow = {
  id: string
  code: string
  name: string
  description: string | null
  is_system: boolean
  source_role: string | null
  permission_keys?: string[]
}

export async function fetchPermissionGroupsWithRules(): Promise<
  PermissionGroupListRow[]
> {
  const res = await fetch("/api/admin/permission-groups?withRules=1", {
    cache: "no-store",
  })
  const data = (await res.json()) as {
    groups?: PermissionGroupListRow[]
    error?: string
  }
  if (!res.ok) {
    throw new Error(data.error ?? "Não foi possível carregar os grupos.")
  }
  return data.groups ?? []
}

export function permissionGroupsQueryOptions(enabled: boolean) {
  return queryOptions({
    queryKey: queryKeys.permissionGroupsList(),
    queryFn: fetchPermissionGroupsWithRules,
    enabled,
  })
}