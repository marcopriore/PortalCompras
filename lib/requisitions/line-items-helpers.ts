import {
  parseItemAccountConfigFromDb,
  type ItemAccountConfigEdit,
} from "@/lib/po-account-assignment"
import type { PurchaseOrderItemAccountAssignmentInput } from "@/types/po-account-assignment"

export const REQ_ITEMS_PAGE_SIZE = 10

export type RequisitionEditorLineItem = {
  id: string
  itemId: string
  materialCode: string
  materialDescription: string
  unitOfMeasure: string
  commodityGroup: string
  quantity: number
  observations: string
}

export function emptyRequisitionAccountConfig(): ItemAccountConfigEdit {
  return { category: null, assignments: [], usesApportionment: false }
}

export type LoadedRequisitionItemRow = {
  id: string
  account_assignment_category?: string | null
  account_assignment_distribution?: string | null
  requisition_item_account_assignments?:
    | PurchaseOrderItemAccountAssignmentInput[]
    | Record<string, unknown>[]
    | null
}

export function buildAccountConfigsFromRequisitionItems(
  rows: LoadedRequisitionItemRow[],
): Record<string, ItemAccountConfigEdit> {
  return Object.fromEntries(
    rows.map((row) => {
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

      return [
        row.id,
        parseItemAccountConfigFromDb(
          row.account_assignment_category,
          row.account_assignment_distribution,
          assignmentRows,
        ),
      ]
    }),
  )
}

export const REQUISITION_ITEM_ACCOUNT_SELECT = `
  id,
  material_code,
  material_description,
  quantity,
  unit_of_measure,
  commodity_group,
  observations,
  account_assignment_category,
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
  )
`
