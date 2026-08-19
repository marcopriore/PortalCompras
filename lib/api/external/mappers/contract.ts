// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContractRow = Record<string, any>

export type ContractItemRow = {
  material_code: string | null
  material_description: string | null
  unit_of_measure: string | null
  quantity_contracted: number | null
  unit_price: number | null
  total_price: number | null
  delivery_days: number | null
  notes: string | null
  eliminated?: boolean | null
}

export function mapContractToOutboundPayload(
  row: ContractRow,
  items: ContractItemRow[] = [],
) {
  const supplier = Array.isArray(row.suppliers)
    ? row.suppliers[0]
    : row.suppliers
  const pc = Array.isArray(row.payment_conditions)
    ? row.payment_conditions[0]
    : row.payment_conditions

  return {
    id: row.id,
    code: row.code,
    erp_code: row.erp_code ?? null,
    title: row.title,
    contract_kind: row.contract_kind ?? null,
    type: row.type ?? null,
    status: row.status,
    supplier_code: supplier?.code ?? null,
    supplier_name: supplier?.name ?? null,
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
    value: row.value ?? null,
    total_value: row.total_value ?? null,
    payment_condition_code: pc?.code ?? null,
    payment_condition_description: pc?.description ?? null,
    contract_terms: row.contract_terms ?? null,
    quotation_id: row.quotation_id ?? null,
    accepted_at: row.accepted_at ?? null,
    notes: row.notes ?? null,
    items: items
      .filter((item) => !item.eliminated)
      .map((item) => ({
        material_code: item.material_code,
        material_description: item.material_description,
        unit_of_measure: item.unit_of_measure,
        quantity_contracted: item.quantity_contracted,
        unit_price: item.unit_price,
        total_price: item.total_price,
        delivery_days: item.delivery_days,
        notes: item.notes,
      })),
  }
}
