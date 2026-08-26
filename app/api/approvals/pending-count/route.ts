import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { syncPendingRequisitionApprovals } from "@/lib/approvals/sync-pending-requisitions"

export const runtime = "nodejs"

async function resolveBuyerCompany(userId: string) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, is_superadmin, profile_type, roles, role")
    .eq("id", userId)
    .single()

  if (!profile || profile.profile_type !== "buyer") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  let companyId = profile.company_id as string | null
  if (profile.is_superadmin) {
    const cookieStore = await cookies()
    const selected = cookieStore.get("selected_company_id")?.value
    if (selected) companyId = decodeURIComponent(selected)
  }
  if (!companyId) {
    return { error: NextResponse.json({ error: "Company not found" }, { status: 404 }) }
  }

  const roles = Array.isArray(profile.roles)
    ? profile.roles.filter((r): r is string => typeof r === "string")
    : []
  const isAdmin =
    roles.includes("admin") || profile.role === "admin" || Boolean(profile.is_superadmin)

  return { companyId, isAdmin, userId }
}

/**
 * GET /api/approvals/pending-count
 * Conta aprovações pending do tenant selecionado (service role).
 * Faz sync de REQs pending sem approval_request (legado/seed).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const ctx = await resolveBuyerCompany(user.id)
    if ("error" in ctx) return ctx.error

    const service = createServiceRoleClient()
    await syncPendingRequisitionApprovals(service, ctx.companyId)

    let query = service
      .from("approval_requests")
      .select("id", { count: "exact", head: true })
      .eq("company_id", ctx.companyId)
      .eq("status", "pending")

    if (!ctx.isAdmin) {
      query = query.eq("approver_id", ctx.userId)
    }

    const { count, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: { count: count ?? 0, company_id: ctx.companyId },
    })
  } catch (err) {
    console.error("[approvals/pending-count]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
