import type { SupabaseClient } from "@supabase/supabase-js"
import {
  parseItemAccountConfigFromDb,
  type ItemAccountConfigEdit,
} from "@/lib/po-account-assignment"
import { savePurchaseOrderItemAccountConfig } from "@/lib/po-account-assignment-persist"
import type { PurchaseOrderItemAccountAssignmentInput } from "@/types/po-account-assignment"

type RequisitionItemAccountRow = {
  account_assignment_category: string | null
  account_assignment_distribution: string | null
  requisition_item_account_assignments:
    | PurchaseOrderItemAccountAssignmentInput[]
    | null
}

export async function loadRequisitionItemAccountConfig(
  supabase: SupabaseClient,
  companyId: string,
  requisitionItemId: string,
): Promise<ItemAccountConfigEdit | null> {
  const { data, error } = await supabase
    .from("requisition_items")
    .select(
      `account_assignment_category,
      account_assignment_distribution,
      requisition_item_account_assignments (
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
      )`,
    )
    .eq("id", requisitionItemId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (error || !data) return null

  const row = data as RequisitionItemAccountRow
  const assignmentRows = (row.requisition_item_account_assignments ?? []).map(
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
        assignment.controlling_area != null
          ? String(assignment.controlling_area)
          : null,
      cost_center_code:
        assignment.cost_center_code != null
          ? String(assignment.cost_center_code)
          : null,
      internal_order_id:
        assignment.internal_order_id != null
          ? String(assignment.internal_order_id)
          : null,
      wbs_element:
        assignment.wbs_element != null ? String(assignment.wbs_element) : null,
      asset_number:
        assignment.asset_number != null ? String(assignment.asset_number) : null,
      profit_center:
        assignment.profit_center != null ? String(assignment.profit_center) : null,
    }),
  )

  return parseItemAccountConfigFromDb(
    row.account_assignment_category,
    row.account_assignment_distribution,
    assignmentRows,
  )
}

export async function copyRequisitionAccountConfigToPurchaseOrderItem(
  supabase: SupabaseClient,
  companyId: string,
  requisitionItemId: string,
  purchaseOrderItemId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const config = await loadRequisitionItemAccountConfig(
    supabase,
    companyId,
    requisitionItemId,
  )
  if (!config?.category) return { ok: true }

  return savePurchaseOrderItemAccountConfig(
    supabase,
    companyId,
    purchaseOrderItemId,
    config,
  )
}
