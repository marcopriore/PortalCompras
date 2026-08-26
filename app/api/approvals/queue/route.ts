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
 * Fonte da verdade = status atual da entidade.
 * Sync remove órfãos/duplicatas e cria faltantes; pending = 1:1 com REQs pending.
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

    const { data: pendingReqs } = await service
      .from("requisitions")
      .select(
        "id, code, title, cost_center, status, requester_name, created_at, priority",
      )
      .eq("company_id", ctx.companyId)
      .eq("status", "pending")

    let pendingArQuery = service
      .from("approval_requests")
      .select("*")
      .eq("company_id", ctx.companyId)
      .eq("flow", "requisition")
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    if (!ctx.isAdmin) {
      pendingArQuery = pendingArQuery.eq("approver_id", ctx.userId)
    }

    let historyArQuery = service
      .from("approval_requests")
      .select("*")
      .eq("company_id", ctx.companyId)
      .eq("flow", "requisition")
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(200)

    if (!ctx.isAdmin) {
      historyArQuery = historyArQuery.eq("approver_id", ctx.userId)
    }

    let orderQuery = service
      .from("approval_requests")
      .select("*")
      .eq("company_id", ctx.companyId)
      .eq("flow", "order")
      .order("created_at", { ascending: false })

    if (!ctx.isAdmin) {
      orderQuery = orderQuery.eq("approver_id", ctx.userId)
    }

    const [{ data: pendingArs }, { data: historyArs }, { data: orderData }] =
      await Promise.all([pendingArQuery, historyArQuery, orderQuery])

    const pendingReqIds = new Set((pendingReqs ?? []).map((r) => r.id as string))
    const arByEntity = new Map<string, ApprovalRequestRow>()
    for (const ar of (pendingArs ?? []) as ApprovalRequestRow[]) {
      if (!pendingReqIds.has(ar.entity_id)) continue
      if (!arByEntity.has(ar.entity_id)) arByEntity.set(ar.entity_id, ar)
    }

    // Uma linha pending por REQ pending (admin vê todas; aprovador só as dele)
    const pendingRows: ApprovalRequestRow[] = []
    for (const req of pendingReqs ?? []) {
      const ar = arByEntity.get(req.id as string)
      if (!ar) continue
      if (!ctx.isAdmin && ar.approver_id !== ctx.userId) continue
      pendingRows.push(ar)
    }

    const reqRequests = [
      ...pendingRows,
      ...((historyArs ?? []) as ApprovalRequestRow[]),
    ]

    const historyEntityIds = [
      ...new Set(
        ((historyArs ?? []) as ApprovalRequestRow[]).map((r) => r.entity_id),
      ),
    ]
    const orderRequests = (orderData ?? []) as ApprovalRequestRow[]
    const orderEntityIds = [...new Set(orderRequests.map((r) => r.entity_id))]

    const [histReqsRes, ordsRes] = await Promise.all([
      historyEntityIds.length > 0
        ? service
            .from("requisitions")
            .select(
              "id, code, title, cost_center, status, requester_name, created_at, priority",
            )
            .in("id", historyEntityIds)
        : Promise.resolve({ data: [] as unknown[] }),
      orderEntityIds.length > 0
        ? service
            .from("purchase_orders")
            .select("id, code, total_price, supplier_name, status, created_at")
            .in("id", orderEntityIds)
        : Promise.resolve({ data: [] as unknown[] }),
    ])

    const requisitions = [
      ...(pendingReqs ?? []),
      ...(((histReqsRes.data ?? []) as NonNullable<typeof pendingReqs>)),
    ]

    return NextResponse.json({
      data: {
        synced,
        pending_count: pendingRows.length,
        requisition_requests: reqRequests,
        order_requests: orderRequests,
        requisitions,
        orders: ordsRes.data ?? [],
      },
    })
  } catch (err) {
    console.error("[approvals/queue]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
