import { queryOptions } from "@tanstack/react-query"
import type { SupabaseClient } from "@supabase/supabase-js"
import { buildContractItemLineNumberMap } from "@/lib/contracts/contract-balance-helpers"
import {
  parseItemAccountConfigFromDb,
  type ItemAccountConfigEdit,
} from "@/lib/po-account-assignment"
import { formatResponsibleName } from "@/lib/quotations/ownership"
import { queryKeys } from "@/lib/queries/keys"
import { isPorValue } from "@/lib/validation/numeric-input"
import type { PurchaseOrderItemAccountAssignmentInput } from "@/types/po-account-assignment"

export type PurchaseOrderDetailStatus =
  | "draft"
  | "awaiting_approval"
  | "processing"
  | "sent"
  | "refused"
  | "error"
  | "integration_error"
  | "completed"
  | "cancelled"

export type PurchaseOrderDetail = {
  id: string
  company_id: string
  code: string
  erp_code: string | null
  external_code: string | null
  supplier_id: string | null
  supplier_name: string
  supplier_cnpj: string | null
  payment_condition: string | null
  delivery_days: number | null
  delivery_address: string | null
  quotation_code: string | null
  requisition_code: string | null
  total_price: number | null
  status: PurchaseOrderDetailStatus
  erp_error_message: string | null
  cancellation_reason: string | null
  estimated_delivery_date: string | null
  delivery_date_change_reason: string | null
  accepted_at: string | null
  accepted_by_supplier: boolean | null
  observations: string | null
  created_at: string
  updated_at: string | null
  created_by: string | null
}

export type PurchaseOrderDetailItem = {
  id: string
  material_code: string
  material_description: string
  quantity: number
  unit_of_measure: string | null
  unit_price: number
  price_unit: number
  tax_percent: number | null
  total_price: number | null
  contract_id: string | null
  contract_item_id: string | null
  contract_code: string | null
  contract_item_line: number | null
  requisition_item_id: string | null
  source_requisition_code: string | null
  site_code: string | null
  account_assignment_category: string | null
  account_assignment_distribution: string | null
  account_assignments: PurchaseOrderItemAccountAssignmentInput[]
}

export type PurchaseOrderDetailEditItem = {
  id: string
  material_code: string
  material_description: string
  unit_of_measure: string
  unit_price: number
  price_unit: number
  tax_percent: number | null
  quantity: number
  max_quantity: number | null
  requisition_item_id: string | null
  source_requisition_code: string | null
}

export type PurchaseOrderDetailDraftSupplier = {
  id: string
  name: string
  cnpj: string | null
  code: string
}

export type PurchaseOrderDetailPaymentOption = {
  id: string
  code: string
  description: string
}

export type PurchaseOrderDetailAuditLog = {
  id: string
  event_type: string
  description: string
  created_at: string
  user_name: string | null
  metadata: Record<string, unknown> | null
}

export type PurchaseOrderDetailDto = {
  order: PurchaseOrderDetail | null
  responsibleName: string
  items: PurchaseOrderDetailItem[]
  accountConfigs: Record<string, ItemAccountConfigEdit>
  paymentOptions: PurchaseOrderDetailPaymentOption[]
  orderLogs: PurchaseOrderDetailAuditLog[]
  editItems: PurchaseOrderDetailEditItem[]
  draftSupplier: PurchaseOrderDetailDraftSupplier | null
  requisitionIdByCode: Record<string, string>
  pendingCatalogApproval: boolean
}

type RawPoItemRow = Record<string, unknown> & {
  contracts?: { code?: string } | { code?: string }[] | null
  contract_items?:
    | {
        contract_id?: string
        contracts?: { code?: string } | { code?: string }[] | null
      }
    | {
        contract_id?: string
        contracts?: { code?: string } | { code?: string }[] | null
      }[]
    | null
  purchase_order_item_account_assignments?:
    | PurchaseOrderItemAccountAssignmentInput[]
    | null
  company_branches?:
    | { code?: string; name?: string }
    | { code?: string; name?: string }[]
    | null
}

function mapPurchaseOrderItems(
  rawItems: RawPoItemRow[],
  lineNumberMap: Map<string, number>,
): PurchaseOrderDetailItem[] {
  return rawItems.map((row) => {
    const contractEmbed = Array.isArray(row.contracts) ? row.contracts[0] : row.contracts
    const itemEmbed = Array.isArray(row.contract_items)
      ? row.contract_items[0]
      : row.contract_items
    const nestedContract = itemEmbed?.contracts
      ? Array.isArray(itemEmbed.contracts)
        ? itemEmbed.contracts[0]
        : itemEmbed.contracts
      : null
    const contractItemId = row.contract_item_id != null ? String(row.contract_item_id) : null
    const resolvedContractId =
      row.contract_id != null
        ? String(row.contract_id)
        : itemEmbed?.contract_id
          ? String(itemEmbed.contract_id)
          : null
    const branchEmbed = Array.isArray(row.company_branches)
      ? row.company_branches[0]
      : row.company_branches
    const assignmentRows = (row.purchase_order_item_account_assignments ?? []).map(
      (assignment) => ({
        sequence: Number(assignment.sequence ?? 1),
        apportionment_percent: Number(assignment.apportionment_percent ?? 0),
        currency: assignment.currency != null ? String(assignment.currency) : "BRL",
        ledger_account_code:
          assignment.ledger_account_code != null
            ? String(assignment.ledger_account_code)
            : null,
        business_area:
          assignment.business_area != null ? String(assignment.business_area) : null,
        controlling_area:
          assignment.controlling_area != null ? String(assignment.controlling_area) : null,
        cost_center_code:
          assignment.cost_center_code != null ? String(assignment.cost_center_code) : null,
        internal_order_id:
          assignment.internal_order_id != null ? String(assignment.internal_order_id) : null,
        wbs_element: assignment.wbs_element != null ? String(assignment.wbs_element) : null,
        asset_number:
          assignment.asset_number != null ? String(assignment.asset_number) : null,
        profit_center:
          assignment.profit_center != null ? String(assignment.profit_center) : null,
      }),
    )
    return {
      id: String(row.id ?? ""),
      material_code: String(row.material_code ?? ""),
      material_description: String(row.material_description ?? ""),
      quantity: Number(row.quantity ?? 0),
      unit_of_measure: row.unit_of_measure != null ? String(row.unit_of_measure) : null,
      unit_price: Number(row.unit_price ?? 0),
      price_unit:
        row.price_unit != null && isPorValue(Number(row.price_unit))
          ? Number(row.price_unit)
          : 1,
      tax_percent: row.tax_percent != null ? Number(row.tax_percent) : null,
      total_price: row.total_price != null ? Number(row.total_price) : null,
      contract_id: resolvedContractId,
      contract_item_id: contractItemId,
      contract_code: contractEmbed?.code
        ? String(contractEmbed.code)
        : nestedContract?.code
          ? String(nestedContract.code)
          : null,
      contract_item_line: contractItemId ? (lineNumberMap.get(contractItemId) ?? null) : null,
      requisition_item_id:
        row.requisition_item_id != null ? String(row.requisition_item_id) : null,
      source_requisition_code:
        row.source_requisition_code != null ? String(row.source_requisition_code) : null,
      site_code:
        row.site_code != null
          ? String(row.site_code)
          : branchEmbed?.code != null
            ? String(branchEmbed.code)
            : null,
      account_assignment_category:
        row.account_assignment_category != null
          ? String(row.account_assignment_category)
          : null,
      account_assignment_distribution:
        row.account_assignment_distribution != null
          ? String(row.account_assignment_distribution)
          : "",
      account_assignments: assignmentRows,
    }
  })
}

const PO_ITEMS_SELECT = `id,
              material_code,
              material_description,
              quantity,
              unit_of_measure,
              unit_price,
              price_unit,
              tax_percent,
              total_price,
              contract_id,
              contract_item_id,
              contracts:contract_id (code),
              contract_items:contract_item_id (
                contract_id,
                contracts:contract_id (code)
              ),
              requisition_item_id,
              source_requisition_code,
              site_code,
              company_branches (code, name),
              account_assignment_category,
              account_assignment_distribution,
              purchase_order_item_account_assignments (
                sequence,
                apportionment_percent,
                currency,
                ledger_account_code,
                business_area,
                controlling_area,
                cost_center_code,
                internal_order_id,
                wbs_element,
                asset_number,
                profit_center
              )` as const

export async function fetchPurchaseOrderDetail(
  supabase: SupabaseClient,
  companyId: string,
  id: string,
): Promise<PurchaseOrderDetailDto> {
  const emptyDraftExtras = {
    editItems: [] as PurchaseOrderDetailEditItem[],
    draftSupplier: null as PurchaseOrderDetailDraftSupplier | null,
    requisitionIdByCode: {} as Record<string, string>,
  }

  const [orderRes, itemsRes, paymentsRes, logsRes] = await Promise.all([
    supabase.from("purchase_orders").select("*").eq("id", id).eq("company_id", companyId).single(),
    supabase
      .from("purchase_order_items")
      .select(PO_ITEMS_SELECT)
      .eq("purchase_order_id", id)
      .order("material_code", { ascending: true }),
    supabase
      .from("payment_conditions")
      .select("id, code, description")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("code", { ascending: true }),
    supabase
      .from("audit_logs")
      .select("id, event_type, description, created_at, user_name, metadata")
      .eq("entity_id", id)
      .in("event_type", [
        "purchase_order.accepted",
        "purchase_order.refused",
        "purchase_order.delivery_updated",
      ])
      .order("created_at", { ascending: true }),
  ])

  if (orderRes.error) {
    throw orderRes.error
  }

  const loadedOrder = (orderRes.data as PurchaseOrderDetail | null) ?? null

  let responsibleName = "—"
  if (loadedOrder?.created_by) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", loadedOrder.created_by)
      .maybeSingle()
    responsibleName = formatResponsibleName(
      (ownerProfile as { full_name?: string | null } | null)?.full_name,
    )
  }

  const rawItems = (itemsRes.data ?? []) as RawPoItemRow[]
  let lineNumberMap = new Map<string, number>()
  const contractIds = new Set<string>()
  for (const row of rawItems) {
    if (row.contract_id != null) {
      contractIds.add(String(row.contract_id))
    }
    const itemEmbed = Array.isArray(row.contract_items) ? row.contract_items[0] : row.contract_items
    if (itemEmbed?.contract_id) {
      contractIds.add(String(itemEmbed.contract_id))
    }
  }
  if (contractIds.size > 0) {
    const { data: contractItemRows } = await supabase
      .from("contract_items")
      .select("id, contract_id, created_at, eliminated")
      .in("contract_id", [...contractIds])
    lineNumberMap = buildContractItemLineNumberMap(
      (contractItemRows ?? []) as Array<{
        id: string
        contract_id: string
        created_at: string
        eliminated: boolean
      }>,
    )
  }

  const poItems = mapPurchaseOrderItems(rawItems, lineNumberMap)

  const accountConfigs = Object.fromEntries(
    poItems.map((item) => [
      item.id,
      parseItemAccountConfigFromDb(
        item.account_assignment_category,
        item.account_assignment_distribution,
        item.account_assignments,
      ),
    ]),
  )

  const paymentOptions = ((paymentsRes.data as PurchaseOrderDetailPaymentOption[]) ??
    []) as PurchaseOrderDetailPaymentOption[]

  const orderLogs = logsRes.error
    ? []
    : (((logsRes.data as PurchaseOrderDetailAuditLog[]) ?? []) as PurchaseOrderDetailAuditLog[])

  let draftExtras = { ...emptyDraftExtras }

  if (loadedOrder?.status === "draft" || loadedOrder?.status === "awaiting_approval") {
    if (loadedOrder.status === "draft") {
      const reqItemIds = poItems
        .map((item) => item.requisition_item_id)
        .filter((value): value is string => Boolean(value))
      let maxQtyByReqItem: Record<string, number> = {}
      if (reqItemIds.length > 0) {
        const { data: reqItemsData } = await supabase
          .from("requisition_items")
          .select("id, quantity")
          .in("id", reqItemIds)
        maxQtyByReqItem = Object.fromEntries(
          (reqItemsData ?? []).map((row) => [String(row.id), Number(row.quantity)]),
        )
      }

      const editItems: PurchaseOrderDetailEditItem[] = poItems.map((item) => ({
        id: item.id,
        material_code: item.material_code,
        material_description: item.material_description,
        unit_of_measure: item.unit_of_measure ?? "",
        unit_price: Number(item.unit_price),
        price_unit: item.price_unit,
        tax_percent: item.tax_percent,
        quantity: Number(item.quantity),
        max_quantity: item.requisition_item_id
          ? (maxQtyByReqItem[item.requisition_item_id] ?? null)
          : null,
        requisition_item_id: item.requisition_item_id,
        source_requisition_code: item.source_requisition_code,
      }))

      let draftSupplier: PurchaseOrderDetailDraftSupplier | null = null
      if (loadedOrder.supplier_id) {
        const { data: supplierRow } = await supabase
          .from("suppliers")
          .select("id, name, cnpj, code")
          .eq("id", loadedOrder.supplier_id)
          .maybeSingle()
        if (supplierRow) {
          draftSupplier = supplierRow as PurchaseOrderDetailDraftSupplier
        } else {
          draftSupplier = {
            id: loadedOrder.supplier_id,
            name: loadedOrder.supplier_name,
            cnpj: loadedOrder.supplier_cnpj,
            code: "",
          }
        }
      }

      const reqCodes = new Set<string>()
      for (const item of poItems) {
        if (item.source_requisition_code) reqCodes.add(item.source_requisition_code)
      }
      if (loadedOrder.requisition_code) {
        for (const code of loadedOrder.requisition_code.split(",").map((c) => c.trim())) {
          if (code) reqCodes.add(code)
        }
      }

      let requisitionIdByCode: Record<string, string> = {}
      if (reqCodes.size > 0) {
        const { data: reqRows } = await supabase
          .from("requisitions")
          .select("id, code")
          .eq("company_id", companyId)
          .in("code", [...reqCodes])
        requisitionIdByCode = Object.fromEntries(
          (reqRows ?? []).map((row) => [String(row.code), String(row.id)]),
        )
      }

      draftExtras = { editItems, draftSupplier, requisitionIdByCode }
    }
  }

  let pendingCatalogApproval = false
  if (
    (loadedOrder?.status === "draft" || loadedOrder?.status === "awaiting_approval") &&
    companyId
  ) {
    const { data: catalogAr } = await supabase
      .from("approval_requests")
      .select("id")
      .eq("company_id", companyId)
      .eq("entity_id", id)
      .eq("flow", "catalog_order")
      .eq("status", "pending")
      .limit(1)
    pendingCatalogApproval = (catalogAr ?? []).length > 0
  }

  return {
    order: loadedOrder,
    responsibleName,
    items: poItems,
    accountConfigs,
    paymentOptions,
    orderLogs,
    editItems: draftExtras.editItems,
    draftSupplier: draftExtras.draftSupplier,
    requisitionIdByCode: draftExtras.requisitionIdByCode,
    pendingCatalogApproval,
  }
}

export type SupabaseClientFactory = () => SupabaseClient

export function purchaseOrderDetailQueryOptions(
  companyId: string,
  id: string,
  supabaseFactory: SupabaseClientFactory,
) {
  return queryOptions({
    queryKey: queryKeys.purchaseOrderDetail(companyId, id),
    queryFn: () => fetchPurchaseOrderDetail(supabaseFactory(), companyId, id),
    enabled: Boolean(companyId && id),
  })
}