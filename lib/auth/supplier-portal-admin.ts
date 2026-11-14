import { NextResponse } from "next/server"
import {
  getBuyerContext,
  type BuyerContext,
} from "@/lib/auth/buyer-context"
import { loadUserPermissionKeys } from "@/lib/permissions/resolve-user-permissions"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type BuyerPortalManagerContext = BuyerContext & {
  profileType: string
  roles: string[]
}

export function normalizeProfileRoles(
  role: string | null | undefined,
  roles: string[] | null | undefined,
): string[] {
  const fromArray = Array.isArray(roles)
    ? roles.filter((r): r is string => typeof r === "string" && r.length > 0)
    : []
  if (fromArray.length > 0) return fromArray
  return role ? [role] : []
}

/**
 * Quem pode criar/resetar usuários do portal fornecedor pelo comprador.
 * Espelha a UI (`isMasterAdmin`) e aceita `user.manage`.
 * Solicitante e view_only nunca passam.
 */
export function buyerMayManageSupplierPortalUsers(input: {
  profileType: string | null | undefined
  isSuperAdmin: boolean
  roles: string[]
  permissionKeys: Iterable<string>
}): boolean {
  if (input.isSuperAdmin) return true
  if (input.profileType !== "buyer") return false
  const keys = new Set(input.permissionKeys)
  if (keys.has("view_only")) return false
  if (input.roles.includes("admin")) return true
  return keys.has("user.manage")
}

async function loadBuyerGateProfile(
  ctx: BuyerContext,
): Promise<{ profileType: string; roles: string[] } | { error: NextResponse }> {
  if (ctx.isSuperAdmin) {
    return { profileType: "buyer", roles: ["admin"] }
  }

  const service = createServiceRoleClient()
  const { data: profile } = await service
    .from("profiles")
    .select("profile_type, role, roles")
    .eq("id", ctx.userId)
    .maybeSingle()

  if (!profile) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return {
    profileType: String(profile.profile_type ?? ""),
    roles: normalizeProfileRoles(
      profile.role as string | null,
      profile.roles as string[] | null,
    ),
  }
}

/** Comprador do tenant (não solicitante / não fornecedor). */
export async function requireBuyerProfile(): Promise<
  BuyerPortalManagerContext | { error: NextResponse }
> {
  const ctx = await getBuyerContext()
  if ("error" in ctx) return ctx

  const loaded = await loadBuyerGateProfile(ctx)
  if ("error" in loaded) return loaded
  if (!ctx.isSuperAdmin && loaded.profileType !== "buyer") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ...ctx, profileType: loaded.profileType, roles: loaded.roles }
}

/** Admin do tenant ou user.manage — mutações do portal fornecedor. */
export async function requireBuyerSupplierPortalManager(): Promise<
  BuyerPortalManagerContext | { error: NextResponse }
> {
  const ctx = await requireBuyerProfile()
  if ("error" in ctx) return ctx
  if (ctx.isSuperAdmin) return ctx

  const service = createServiceRoleClient()
  const keys = await loadUserPermissionKeys(service, ctx.userId, ctx.companyId)
  if (
    !buyerMayManageSupplierPortalUsers({
      profileType: ctx.profileType,
      isSuperAdmin: ctx.isSuperAdmin,
      roles: ctx.roles,
      permissionKeys: keys,
    })
  ) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return ctx
}
