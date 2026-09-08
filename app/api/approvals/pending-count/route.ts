import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { syncPendingRequisitionApprovals } from "@/lib/approvals/sync-pending-requisitions"
import { resolveApprovalsAccess } from "@/lib/approvals/resolve-approvals-access"

export const runtime = "nodejs"

/**
 * GET /api/approvals/pending-count
 * approval.view_all / superadmin: conta REQs status=pending (+ pedidos catalog pending via queue logic simplificada).
 * Aprovador: conta ARs pending atribuídos a ele (após sync).
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

    const ctx = await resolveApprovalsAccess(user.id)
    if ("error" in ctx) return ctx.error

    const service = createServiceRoleClient()
    await syncPendingRequisitionApprovals(service, ctx.companyId)

    if (ctx.canViewAll) {
      const { count, error } = await service
        .from("requisitions")
        .select("id", { count: "exact", head: true })
        .eq("company_id", ctx.companyId)
        .eq("status", "pending")
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({
        data: { count: count ?? 0, company_id: ctx.companyId },
      })
    }

    const { count, error } = await service
      .from("approval_requests")
      .select("id", { count: "exact", head: true })
      .eq("company_id", ctx.companyId)
      .eq("status", "pending")
      .eq("approver_id", ctx.userId)

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
