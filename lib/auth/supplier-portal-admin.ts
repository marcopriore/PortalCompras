import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { PermissionKey } from "@/lib/hooks/usePermissions"
import {
  canUserWrite,
  loadUserPermissionKeys,
} from "@/lib/permissions/resolve-user-permissions"
import { getBuyerContext, type BuyerContext } from "@/lib/auth/buyer-context"

export type SupplierPortalAdminActor = {
  isSuperAdmin: boolean
  role?: string | null
  roles?: string[] | null
  permissionKeys: Set<PermissionKey>
}

function collectRoles(
  role: string | null | undefined,
  roles: string[] | null | undefined,
): string[] {
  const out: string[] = []
  if (typeof role === "string" && role.trim()) out.push(role)
  if (Array.isArray(roles)) {
    for (const item of roles) {
      if (typeof item === "string" && item.trim()) out.push(item)
    }
  }
  return out
}

/** Master admin (UI), superadmin, or user.manage (not view_only). */
export function canManageSupplierPortalUsers(
  actor: SupplierPortalAdminActor,
): boolean {
  if (actor.isSuperAdmin) return true
  if (collectRoles(actor.role, actor.roles).includes("admin")) return true
  return canUserWrite(actor.permissionKeys, "user.manage")
}

/**
 * Mutations of supplier portal users/invites (create, password reset, invite).
 * GET listing stays on getBuyerContext so the modal read-only view still works.
 */
export async function requireSupplierPortalAdmin(): Promise<
  BuyerContext | { error: NextResponse }
> {
  const ctx = await getBuyerContext()
  if ("error" in ctx) return ctx
  if (ctx.isSuperAdmin) return ctx

  const service = createServiceRoleClient()
  const [{ data: profile }, keys] = await Promise.all([
    service
      .from("profiles")
      .select("role, roles")
      .eq("id", ctx.userId)
      .maybeSingle(),
    loadUserPermissionKeys(service, ctx.userId, ctx.companyId),
  ])

  if (
    canManageSupplierPortalUsers({
      isSuperAdmin: false,
      role: (profile?.role as string | null | undefined) ?? null,
      roles: (profile?.roles as string[] | null | undefined) ?? null,
      permissionKeys: keys,
    })
  ) {
    return ctx
  }

  return {
    error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  }
}
