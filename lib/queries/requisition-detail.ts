import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { RequisitionDetailLineItem } from "@/components/requisitions/requisition-line-items-detail-section"
import { REQUISITION_ITEM_ACCOUNT_SELECT } from "@/lib/requisitions/line-items-helpers"
import type { RequisitionStatus } from "@/lib/requisitions/status"
import { queryKeys } from "@/lib/queries/keys"
import type { SupabaseClientFactory } from "@/lib/queries/payment-conditions"

export type RequisitionDetailPriority = "normal" | "urgent" | "critical"

export type RequisitionDetailRequisition = {
  id: string
  code: string
  title: string
  requester_id: string | null
  requester_name: string | null
  cost_center: string | null
  needed_by: string | null
  origin: string | null
  created_at: string
  status: RequisitionStatus
  priority: RequisitionDetailPriority
  rejection_reason?: string | null
  approver_name?: string | null
  approved_at?: string | null
  erp_code?: string | null
  quotation_id?: string | null
}

export type RequisitionDetailQuotationInfo = {
  id: string
  code: string
  status: string
  created_at: string
}

export type RequisitionDetailPurchaseOrder = {
  id: string
  code: string
  status: string
  supplier_name: string
  total_price: number | null
  created_at: string
  accepted_at?: string | null
  estimated_delivery_date: string | null
}

export type RequisitionDetailApprovalHistory = {
  id: string
  status: string
  approver_name: string | null
  rejection_reason: string | null
  decided_at: string | null
  created_at: string
}

export type RequisitionDetailAuditLog = {
  id: string
  event_type: string
  description: string
  created_at: string
  user_name: string | null
  metadata: Record<string, unknown> | null
}

export type RequisitionDetailDto = {
  requisition: RequisitionDetailRequisition | null
  items: RequisitionDetailLineItem[]
  linkedQuotation: { id: string; code: string } | null
  quotation: RequisitionDetailQuotationInfo | null
  orders: RequisitionDetailPurchaseOrder[]
  history: RequisitionDetailApprovalHistory[]
  auditLogs: RequisitionDetailAuditLog[]
}

export type RequisitionAttachmentDto = {
  id: string
  file_name: string
  file_size: number | null
  content_type: string | null
  created_at: string
  download_url: string | null
}

export async function fetchRequisitionDetail(
  supabase: SupabaseClient,
  companyId: string,
  id: string,
): Promise<RequisitionDetailDto> {
  const [rRes, iRes] = await Promise.all([
    supabase.from("requisitions").select("*").eq("id", id).eq("company_id", companyId).single(),
    supabase
      .from("requisition_items")
      .select(REQUISITION_ITEM_ACCOUNT_SELECT)
      .eq("requisition_id", id)
      .eq("company_id", companyId)
      .order("created_at"),
  ])

  const reqData = (rRes.data as RequisitionDetailRequisition | null) ?? null

  let linkedQuotation: { id: string; code: string } | null = null
  let quotation: RequisitionDetailQuotationInfo | null = null
  const quotationId = reqData?.quotation_id
  if (quotationId) {
    const { data: qFull } = await supabase
      .from("quotations")
      .select("id, code, status, created_at")
      .eq("id", quotationId)
      .single()

    if (qFull?.id && qFull?.code) {
      linkedQuotation = { id: qFull.id as string, code: qFull.code as string }
      quotation = qFull as RequisitionDetailQuotationInfo
    }
  }

  let orders: RequisitionDetailPurchaseOrder[] = []
  if (reqData?.code) {
    const { data: ordersData } = await supabase
      .from("purchase_orders")
      .select(
        "id, code, status, supplier_name, total_price, created_at, accepted_at, estimated_delivery_date",
      )
      .eq("requisition_code", reqData.code)
      .order("created_at")
    orders = (ordersData as RequisitionDetailPurchaseOrder[]) ?? []
  }

  const { data: historyData } = await supabase
    .from("approval_requests")
    .select("id, status, approver_name, rejection_reason, decided_at, created_at")
    .eq("entity_id", id)
    .eq("flow", "requisition")
    .order("created_at", { ascending: true })

  const { data: auditData } = await supabase
    .from("audit_logs")
    .select("id, event_type, description, created_at, user_name, metadata")
    .eq("entity", "requisitions")
    .eq("entity_id", id)
    .order("created_at", { ascending: true })

  return {
    requisition: reqData,
    items: ((iRes.data ?? []) as RequisitionDetailLineItem[]) ?? [],
    linkedQuotation,
    quotation,
    orders,
    history: (historyData as RequisitionDetailApprovalHistory[]) ?? [],
    auditLogs: (auditData ?? []) as RequisitionDetailAuditLog[],
  }
}

export async function fetchRequisitionAttachments(
  requisitionId: string,
): Promise<RequisitionAttachmentDto[]> {
  const res = await fetch(`/api/requisitions/${requisitionId}/attachments`)
  const data = (await res.json()) as { attachments?: RequisitionAttachmentDto[] }
  if (!res.ok) {
    return []
  }
  return Array.isArray(data.attachments) ? data.attachments : []
}

export function requisitionDetailQueryOptions(
  companyId: string,
  id: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.requisitionDetail(companyId, id),
    queryFn: () => fetchRequisitionDetail(supabaseFactory(), companyId, id),
    enabled: Boolean(companyId && id),
  })
}

export function requisitionAttachmentsQueryOptions(requisitionId: string) {
  return queryOptions({
    queryKey: queryKeys.requisitionAttachments(requisitionId),
    queryFn: () => fetchRequisitionAttachments(requisitionId),
    enabled: Boolean(requisitionId),
  })
}