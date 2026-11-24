import { queryOptions } from "@tanstack/react-query"
import { queryKeys } from "@/lib/queries/keys"

export type ApprovalStatus = "pending" | "approved" | "rejected"

export type ApprovalRequestRow = {
  id: string
  company_id: string
  flow: "requisition" | "order" | "catalog_order"
  entity_id: string
  approver_id: string | null
  approver_name: string | null
  status: ApprovalStatus
  rejection_reason: string | null
  decided_at: string | null
  created_at: string
}

export type ApprovalRequisitionEntity = {
  id: string
  code: string
  title: string
  cost_center: string | null
  status: string
  requester_name: string | null
  created_at: string
  priority: "normal" | "urgent" | "critical"
}

export type ApprovalPurchaseOrderEntity = {
  id: string
  code: string
  total_price: number | null
  supplier_name: string
  status: string
  created_at: string
}

export type ApprovalsQueueData = {
  requisition_requests: ApprovalRequestRow[]
  order_requests: ApprovalRequestRow[]
  catalog_order_requests: ApprovalRequestRow[]
  requisitions: ApprovalRequisitionEntity[]
  orders: ApprovalPurchaseOrderEntity[]
  catalog_orders: ApprovalPurchaseOrderEntity[]
}

export async function fetchApprovalsQueue(): Promise<ApprovalsQueueData> {
  const res = await fetch("/api/approvals/queue", { cache: "no-store" })
  const payload = (await res.json()) as {
    error?: string
    data?: Partial<ApprovalsQueueData>
  }

  if (!res.ok) {
    throw new Error(payload.error ?? "Erro ao carregar aprovações.")
  }

  const data = payload.data ?? {}

  return {
    requisition_requests: data.requisition_requests ?? [],
    order_requests: data.order_requests ?? [],
    catalog_order_requests: data.catalog_order_requests ?? [],
    requisitions: data.requisitions ?? [],
    orders: data.orders ?? [],
    catalog_orders: data.catalog_orders ?? [],
  }
}

export function approvalsQueueQueryOptions(companyId: string, userId: string) {
  return queryOptions({
    queryKey: queryKeys.approvalsQueue(companyId, userId),
    queryFn: fetchApprovalsQueue,
  })
}