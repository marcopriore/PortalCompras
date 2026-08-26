import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { syncPendingRequisitionApprovals } from "@/lib/approvals/sync-pending-requisitions"

export const runtime = "nodejs"

type ApprovalRequestRow = {
  id: string
  company_id: string
  flow: string
  entity_id: string
  approver_id: string | null
  approver_name: string | null
  status: string
  created_at: string
  decided_at: string | null
  rejection_reason: string | null
}

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
 * GET /api/approvals/queue
 * Lista approval_requests do tenant (service role + sync de REQs órfãs).
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
    const synced = await syncPendingRequisitionApprovals(service, ctx.companyId)

    let reqQuery = service
      .from("approval_requests")
      .select("*")
      .eq("company_id", ctx.companyId)
      .eq("flow", "requisition")
      .order("created_at", { ascending: false })
    let orderQuery = service
      .from("approval_requests")
      .select("*")
      .eq("company_id", ctx.companyId)
      .eq("flow", "order")
      .order("created_at", { ascending: false })

    if (!ctx.isAdmin) {
      reqQuery = reqQuery.eq("approver_id", ctx.userId)
      orderQuery = orderQuery.eq("approver_id", ctx.userId)
    }

    const [{ data: reqData }, { data: orderData }] = await Promise.all([
      reqQuery,
      orderQuery,
    ])

    const reqRequests = (reqData ?? []) as ApprovalRequestRow[]
    const orderRequests = (orderData ?? []) as ApprovalRequestRow[]

    const reqEntityIds = [...new Set(reqRequests.map((r) => r.entity_id))]
    const orderEntityIds = [...new Set(orderRequests.map((r) => r.entity_id))]

    const [reqsRes, ordsRes] = await Promise.all([
      reqEntityIds.length > 0
        ? service
            .from("requisitions")
            .select(
              "id, code, title, cost_center, status, requester_name, created_at, priority",
            )
            .in("id", reqEntityIds)
        : Promise.resolve({ data: [] as unknown[] }),
      orderEntityIds.length > 0
        ? service
            .from("purchase_orders")
            .select("id, code, total_price, supplier_name, status, created_at")
            .in("id", orderEntityIds)
        : Promise.resolve({ data: [] as unknown[] }),
    ])

    return NextResponse.json({
      data: {
        synced,
        requisition_requests: reqRequests,
        order_requests: orderRequests,
        requisitions: reqsRes.data ?? [],
        orders: ordsRes.data ?? [],
      },
    })
  } catch (err) {
    console.error("[approvals/queue]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
