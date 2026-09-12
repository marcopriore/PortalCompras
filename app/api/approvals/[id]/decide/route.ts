import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  approveApprovalRequest,
  rejectApprovalRequest,
} from "@/lib/api/external/approval-service"
import { canPortalUserDecideApproval } from "@/lib/approvals/assert-portal-approval-actor"
import type { PermissionKey } from "@/lib/hooks/usePermissions"
import { loadUserPermissionKeys } from "@/lib/permissions/resolve-user-permissions"

export const runtime = "nodejs"

async function resolveBuyerCompany(userId: string) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, is_superadmin, profile_type, full_name, roles, role")
    .eq("id", userId)
    .single()

  if (!profile || profile.profile_type !== "buyer") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  const isSuperAdmin = Boolean(profile.is_superadmin)
  let companyId = profile.company_id as string | null
  if (isSuperAdmin) {
    const cookieStore = await cookies()
    const selected = cookieStore.get("selected_company_id")?.value
    if (selected) companyId = decodeURIComponent(selected)
  }
  if (!companyId) {
    return { error: NextResponse.json({ error: "Company not found" }, { status: 404 }) }
  }

  return {
    companyId,
    userId,
    fullName: profile.full_name ?? "",
    isSuperAdmin,
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const ctx = await resolveBuyerCompany(user.id)
    if ("error" in ctx) return ctx.error

    let body: { action?: string; reason?: string } = {}
    try {
      body = (await request.json()) as { action?: string; reason?: string }
    } catch {
      body = {}
    }

    const action = body.action === "reject" ? "reject" : "approve"
    const service = createServiceRoleClient()

    const { data: approvalRow, error: approvalErr } = await service
      .from("approval_requests")
      .select("id, flow, approver_id, status")
      .eq("company_id", ctx.companyId)
      .eq("id", id)
      .maybeSingle()

    if (approvalErr) {
      return NextResponse.json({ error: approvalErr.message }, { status: 500 })
    }
    if (!approvalRow) {
      return NextResponse.json({ error: "Aprovação não encontrada." }, { status: 404 })
    }

    const permissions: Set<PermissionKey> = ctx.isSuperAdmin
      ? new Set()
      : await loadUserPermissionKeys(service, ctx.userId, ctx.companyId)

    const actor = canPortalUserDecideApproval({
      isSuperAdmin: ctx.isSuperAdmin,
      userId: ctx.userId,
      approverId: approvalRow.approver_id as string | null,
      flow: String(approvalRow.flow ?? ""),
      permissions,
    })
    if (!actor.ok) {
      return NextResponse.json({ error: actor.reason }, { status: 403 })
    }

    if (action === "approve") {
      const result = await approveApprovalRequest(service, ctx.companyId, id, {
        decidedByName: ctx.fullName,
      })
      if (!result.ok) {
        const status =
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "CONFLICT"
              ? 409
              : result.code === "FORBIDDEN"
                ? 403
                : 500
        return NextResponse.json(
          { error: "message" in result ? result.message : "Erro ao aprovar." },
          { status },
        )
      }
      return NextResponse.json({ data: result })
    }

    const reason = body.reason?.trim()
    if (!reason) {
      return NextResponse.json({ error: "Motivo da rejeição é obrigatório." }, { status: 400 })
    }

    const result = await rejectApprovalRequest(service, ctx.companyId, id, reason, {
      decidedByName: ctx.fullName,
    })
    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "CONFLICT"
            ? 409
            : result.code === "FORBIDDEN"
              ? 403
              : result.code === "VALIDATION_ERROR"
                ? 400
                : 500
      return NextResponse.json(
        { error: "message" in result ? result.message : "Erro ao rejeitar." },
        { status },
      )
    }
    return NextResponse.json({ data: result })
  } catch (err) {
    console.error("[approvals/decide]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
