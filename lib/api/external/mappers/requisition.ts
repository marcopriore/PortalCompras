// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RequisitionRow = Record<string, any>

export type RequisitionItemRow = {
  id: string
  material_code: string | null
  material_description: string
  quantity: number
  unit_of_measure: string | null
  estimated_price: number | null
  commodity_group: string | null
  observations: string | null
}

export function mapRequisitionToApi(
  row: RequisitionRow,
  items: RequisitionItemRow[] = [],
) {
  return {
    id: row.id,
    code: row.code,
    external_code: row.external_code ?? null,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    priority: row.priority,
    requester_name: row.requester_name ?? null,
    cost_center: row.cost_center ?? null,
    needed_by: row.needed_by ?? null,
    origin: row.origin ?? null,
    quotation_id: row.quotation_id ?? null,
    rejection_reason: row.rejection_reason ?? null,
    approver_name: row.approver_name ?? null,
    approved_at: row.approved_at ?? null,
    created_at: row.created_at,
    items: items.map((item) => ({
      material_code: item.material_code,
      material_description: item.material_description,
      quantity: item.quantity,
      unit_of_measure: item.unit_of_measure,
      estimated_price: item.estimated_price,
      commodity_group: item.commodity_group,
      observations: item.observations,
    })),
  }
}

export const REQUISITION_LIST_SELECT =
  "id, code, external_code, title, description, status, priority, requester_name, cost_center, needed_by, origin, quotation_id, rejection_reason, approver_name, approved_at, created_at"
