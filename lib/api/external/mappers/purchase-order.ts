// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PurchaseOrderRow = Record<string, any>

export type PurchaseOrderItemRow = {
  material_code: string | null
  material_description: string | null
  quantity: number | null
  unit_of_measure: string | null
  unit_price: number | null
  total_price: number | null
  delivery_days: number | null
}

export function mapPurchaseOrderToApi(
  row: PurchaseOrderRow,
  items: PurchaseOrderItemRow[] = [],
) {
  return {
    id: row.id,
    code: row.code,
    external_code: row.external_code ?? row.erp_code ?? null,
    status: row.status,
    supplier_name: row.supplier_name ?? null,
    supplier_cnpj: row.supplier_cnpj ?? null,
    quotation_code: row.quotation_code ?? null,
    requisition_code: row.requisition_code ?? null,
    total_price: row.total_price ?? null,
    delivery_days: row.delivery_days ?? null,
    payment_condition: row.payment_condition ?? null,
    estimated_delivery_date: row.estimated_delivery_date ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
    items: items.map((item) => ({
      material_code: item.material_code,
      material_description: item.material_description,
      quantity: item.quantity,
      unit_of_measure: item.unit_of_measure,
      unit_price: item.unit_price,
      total_price: item.total_price,
      delivery_days: item.delivery_days,
    })),
  }
}

export const PURCHASE_ORDER_LIST_SELECT =
  "id, code, external_code, erp_code, status, supplier_name, supplier_cnpj, quotation_code, requisition_code, total_price, delivery_days, payment_condition, estimated_delivery_date, created_at, updated_at"
