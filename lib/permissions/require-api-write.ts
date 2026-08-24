import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { PermissionKey } from "@/lib/hooks/usePermissions"
import {
  canUserWrite,
  loadUserPermissionKeys,
} from "@/lib/permissions/resolve-user-permissions"

export async function requireApiWritePermission(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  isSuperAdmin: boolean,
  permission: PermissionKey,
): Promise<NextResponse | null> {
  if (isSuperAdmin) return null

  const permissions = await loadUserPermissionKeys(supabase, userId, companyId)
  if (!canUserWrite(permissions, permission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return null
}
