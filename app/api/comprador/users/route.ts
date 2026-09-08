import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getBuyerContext } from "@/lib/auth/buyer-context"
import { canUserImpersonate } from "@/lib/impersonation/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  hasUserPermission,
  loadUserPermissionKeys,
} from "@/lib/permissions/resolve-user-permissions"

function authAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Lista usuários do tenant (buyer/requester) com e-mail.
 * Acesso: superadmin, user.manage ou user.impersonate.
 */
export async function GET() {
  try {
    const ctx = await getBuyerContext()
    if ("error" in ctx) return ctx.error

    const canImpersonate = await canUserImpersonate(
      ctx.userId,
      ctx.companyId,
      ctx.isSuperAdmin,
    )

    let canManageUsers = ctx.isSuperAdmin
    if (!canManageUsers) {
      const service = createServiceRoleClient()
      const keys = await loadUserPermissionKeys(service, ctx.userId, ctx.companyId)
      canManageUsers = hasUserPermission(keys, "user.manage")
    }

    if (!canManageUsers && !canImpersonate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const supabase = createServiceRoleClient()
    const authAdmin = authAdminClient()

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, role, roles, status, created_at, profile_type, is_superadmin, cost_center_id, cost_centers(id, code, description)",
      )
      .eq("company_id", ctx.companyId)
      .eq("is_superadmin", false)
      .neq("profile_type", "supplier")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const tenantUsers = (profiles ?? []).filter((p) => {
      if (p.is_superadmin) return false
      if (p.profile_type === "supplier") return false
      if (p.role === "supplier") return false
      const roles = Array.isArray(p.roles) ? p.roles : []
      if (roles.includes("supplier")) return false
      return true
    })

    const userIds = tenantUsers.map((p) => p.id)
    const groupsByUser = new Map<
      string,
      { id: string; code: string; name: string }[]
    >()
    if (userIds.length > 0) {
      const { data: links } = await supabase
        .from("profile_permission_groups")
        .select("user_id, permission_groups(id, code, name)")
        .eq("company_id", ctx.companyId)
        .in("user_id", userIds)

      for (const row of links ?? []) {
        const gRaw = row.permission_groups as
          | { id: string; code: string; name: string }
          | { id: string; code: string; name: string }[]
          | null
        const g = Array.isArray(gRaw) ? gRaw[0] : gRaw
        if (!g?.id) continue
        const list = groupsByUser.get(row.user_id as string) ?? []
        list.push({ id: g.id, code: g.code, name: g.name })
        groupsByUser.set(row.user_id as string, list)
      }
    }

    const users = await Promise.all(
      tenantUsers.map(async (p) => {
        const { data: authUser } = await authAdmin.auth.admin.getUserById(p.id)
        const ccRel = p.cost_centers as
          | { id?: string; code?: string; description?: string }
          | { id?: string; code?: string; description?: string }[]
          | null
        const cc = Array.isArray(ccRel) ? ccRel[0] : ccRel
        const permissionGroups = groupsByUser.get(p.id) ?? []
        return {
          id: p.id,
          full_name: p.full_name,
          role: p.role,
          roles: p.roles,
          permission_groups: permissionGroups,
          status: p.status,
          created_at: p.created_at,
          profile_type: p.profile_type,
          email: authUser?.user?.email ?? null,
          cost_center_id: p.cost_center_id ?? null,
          cost_center_code: cc?.code ?? null,
          cost_center_description: cc?.description ?? null,
        }
      }),
    )

    return NextResponse.json({ users })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
