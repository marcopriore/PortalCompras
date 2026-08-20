import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getBuyerContext } from "@/lib/auth/buyer-context"
import { canUserImpersonate } from "@/lib/impersonation/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function authAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Lista usuários do tenant (buyer/requester) com e-mail.
 * Acesso: admin do tenant, superadmin ou quem tem user.impersonate.
 */
export async function GET() {
  try {
    const ctx = await getBuyerContext()
    if ("error" in ctx) return ctx.error

    const { data: actor } = await ctx.supabase
      .from("profiles")
      .select("role, roles")
      .eq("id", ctx.userId)
      .single()

    const roles = (actor?.roles as string[] | null) ?? []
    const isTenantAdmin =
      ctx.isSuperAdmin ||
      actor?.role === "admin" ||
      roles.includes("admin") ||
      roles.includes("manager")

    const canImpersonate = await canUserImpersonate(
      ctx.userId,
      ctx.companyId,
      ctx.isSuperAdmin,
    )

    if (!isTenantAdmin && !canImpersonate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const supabase = createServiceRoleClient()
    const authAdmin = authAdminClient()

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, roles, status, created_at, profile_type, is_superadmin")
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

    const users = await Promise.all(
      tenantUsers.map(async (p) => {
        const { data: authUser } = await authAdmin.auth.admin.getUserById(p.id)
        return {
          id: p.id,
          full_name: p.full_name,
          role: p.role,
          roles: p.roles,
          status: p.status,
          created_at: p.created_at,
          profile_type: p.profile_type,
          email: authUser?.user?.email ?? null,
        }
      }),
    )

    return NextResponse.json({ users })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
