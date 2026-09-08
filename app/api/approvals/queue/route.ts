import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { syncPendingRequisitionApprovals } from "@/lib/approvals/sync-pending-requisitions"
import { resolveApprovalsAccess } from "@/lib/approvals/resolve-approvals-access"

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

/**
 * GET /api/approvals/queue
 * Fonte da verdade = status atual da entidade.
 * Sync remove órfãos/duplicatas e cria faltantes; pending = 1:1 com REQs pending.
 * Ver todas: permission approval.view_all (ou superadmin). Caso contrário, só as do aprovador.
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

    if (!ctx.canViewAll) {
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

    if (!ctx.canViewAll) {
      historyArQuery = historyArQuery.eq("approver_id", ctx.userId)
    }

    let orderQuery = service
      .from("approval_requests")
      .select("*")
      .eq("company_id", ctx.companyId)
      .eq("flow", "order")
      .order("created_at", { ascending: false })

    if (!ctx.canViewAll) {
      orderQuery = orderQuery.eq("approver_id", ctx.userId)
    }

    let catalogQuery = service
      .from("approval_requests")
      .select("*")
      .eq("company_id", ctx.companyId)
      .eq("flow", "catalog_order")
      .order("created_at", { ascending: false })

    if (!ctx.canViewAll) {
      catalogQuery = catalogQuery.eq("approver_id", ctx.userId)
    }

    const [
      { data: pendingArs },
      { data: historyArs },
      { data: orderData },
      { data: catalogData },
    ] = await Promise.all([
      pendingArQuery,
      historyArQuery,
      orderQuery,
      catalogQuery,
    ])

    const pendingReqIds = new Set((pendingReqs ?? []).map((r) => r.id as string))
    const arByEntity = new Map<string, ApprovalRequestRow>()
    for (const ar of (pendingArs ?? []) as ApprovalRequestRow[]) {
      if (!pendingReqIds.has(ar.entity_id)) continue
      if (!arByEntity.has(ar.entity_id)) arByEntity.set(ar.entity_id, ar)
    }

    const pendingRows: ApprovalRequestRow[] = []
    for (const req of pendingReqs ?? []) {
      const ar = arByEntity.get(req.id as string)
      if (!ar) continue
      if (!ctx.canViewAll && ar.approver_id !== ctx.userId) continue
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
    const catalogRequests = (catalogData ?? []) as ApprovalRequestRow[]
    const catalogEntityIds = [
      ...new Set(catalogRequests.map((r) => r.entity_id)),
    ]

    const [histReqsRes, ordsRes, catalogOrdsRes] = await Promise.all([
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
      catalogEntityIds.length > 0
        ? service
            .from("purchase_orders")
            .select(
              "id, code, total_price, supplier_name, status, created_at, requisition_code",
            )
            .in("id", catalogEntityIds)
        : Promise.resolve({ data: [] as unknown[] }),
    ])

    const requisitions = [
      ...(pendingReqs ?? []),
      ...(((histReqsRes.data ?? []) as NonNullable<typeof pendingReqs>)),
    ]

    return NextResponse.json({
      data: {
        synced,
        pending_count:
          pendingRows.length +
          catalogRequests.filter((r) => r.status === "pending").length,
        requisition_requests: reqRequests,
        order_requests: orderRequests,
        catalog_order_requests: catalogRequests,
        requisitions,
        orders: ordsRes.data ?? [],
        catalog_orders: catalogOrdsRes.data ?? [],
      },
    })
  } catch (err) {
    console.error("[approvals/queue]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
