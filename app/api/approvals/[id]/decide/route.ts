import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  approveApprovalRequest,
  rejectApprovalRequest,
} from "@/lib/api/external/approval-service"

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

  let companyId = profile.company_id as string | null
  if (profile.is_superadmin) {
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
