import {
  contractAvailableValue,
  contractItemAvailableQuantity,
  contractItemAvailableValue,
  contractValueCeiling,
} from "@/lib/contracts/contract-balance-helpers"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContractRow = Record<string, any>

export type ContractItemRow = {
  id?: string
  material_code: string | null
  material_description: string | null
  unit_of_measure: string | null
  quantity_contracted: number | null
  quantity_consumed?: number | null
  reserved_quantity?: number | null
  unit_price: number | null
  total_price: number | null
  consumed_value?: number | null
  reserved_value?: number | null
  delivery_days: number | null
  notes: string | null
  eliminated?: boolean | null
}

export type ContractAcceptanceRow = {
  id: string
  action: string
  notes: string | null
  term_version: string | null
  term_version_date: string | null
  created_at: string
  supplier_id: string | null
}

export const CONTRACT_LIST_SELECT = `
  id, code, erp_code, title, contract_kind, type, status,
  start_date, end_date, value, total_value,
  consumed_value, reserved_value, consumed_quantity, reserved_quantity,
  quotation_id, notes, accepted_at, created_at, updated_at,
  suppliers(name, code),
  payment_conditions(code, description)
`

function embedOne(
  value: unknown,
): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return (value[0] as Record<string, unknown> | undefined) ?? null
  }
  if (value && typeof value === "object") {
    return value as Record<string, unknown>
  }
  return null
}

export function mapContractToApi(
  row: ContractRow,
  items: ContractItemRow[] = [],
) {
  const supplier = embedOne(row.suppliers)
  const pc = embedOne(row.payment_conditions)
  const ceiling = contractValueCeiling({
    value: row.value != null ? Number(row.value) : null,
    total_value: row.total_value != null ? Number(row.total_value) : null,
  })
  const availableValue = contractAvailableValue({
    value: row.value != null ? Number(row.value) : null,
    total_value: row.total_value != null ? Number(row.total_value) : null,
    consumed_value: Number(row.consumed_value ?? 0),
    reserved_value: Number(row.reserved_value ?? 0),
  })

  return {
    id: row.id,
    code: row.code,
    erp_code: row.erp_code ?? null,
    title: row.title,
    contract_kind: row.contract_kind ?? null,
    type: row.type ?? null,
    status: row.status,
    supplier_code: supplier?.code != null ? String(supplier.code) : null,
    supplier_name: supplier?.name != null ? String(supplier.name) : null,
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
    value: row.value != null ? Number(row.value) : null,
    total_value: row.total_value != null ? Number(row.total_value) : null,
    value_ceiling: ceiling,
    consumed_value: Number(row.consumed_value ?? 0),
    reserved_value: Number(row.reserved_value ?? 0),
    available_value: availableValue,
    consumed_quantity: Number(row.consumed_quantity ?? 0),
    reserved_quantity: Number(row.reserved_quantity ?? 0),
    payment_condition_code: pc?.code != null ? String(pc.code) : null,
    payment_condition_description:
      pc?.description != null ? String(pc.description) : null,
    quotation_id: row.quotation_id ?? null,
    accepted_at: row.accepted_at ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
    items: items
      .filter((item) => !item.eliminated)
      .map((item) => {
        const quantity_contracted = Number(item.quantity_contracted ?? 0)
        const quantity_consumed = Number(item.quantity_consumed ?? 0)
        const reserved_quantity = Number(item.reserved_quantity ?? 0)
        const total_price = Number(item.total_price ?? 0)
        const consumed_value = Number(item.consumed_value ?? 0)
        const reserved_value = Number(item.reserved_value ?? 0)
        return {
          id: item.id ?? null,
          material_code: item.material_code,
          material_description: item.material_description,
          unit_of_measure: item.unit_of_measure,
          quantity_contracted,
          quantity_consumed,
          reserved_quantity,
          available_quantity: contractItemAvailableQuantity({
            quantity_contracted,
            quantity_consumed,
            reserved_quantity,
            eliminated: Boolean(item.eliminated),
          }),
          unit_price: item.unit_price != null ? Number(item.unit_price) : null,
          total_price,
          consumed_value,
          reserved_value,
          available_value: contractItemAvailableValue({
            total_price,
            consumed_value,
            reserved_value,
            eliminated: Boolean(item.eliminated),
          }),
          delivery_days: item.delivery_days,
          notes: item.notes,
        }
      }),
  }
}

export function mapContractBalanceToApi(
  row: ContractRow,
  items: ContractItemRow[] = [],
) {
  const mapped = mapContractToApi(row, items)
  return {
    contract_id: mapped.id,
    code: mapped.code,
    erp_code: mapped.erp_code,
    contract_kind: mapped.contract_kind,
    status: mapped.status,
    value_ceiling: mapped.value_ceiling,
    consumed_value: mapped.consumed_value,
    reserved_value: mapped.reserved_value,
    available_value: mapped.available_value,
    consumed_quantity: mapped.consumed_quantity,
    reserved_quantity: mapped.reserved_quantity,
    items: mapped.items.map((item) => ({
      id: item.id,
      material_code: item.material_code,
      material_description: item.material_description,
      quantity_contracted: item.quantity_contracted,
      quantity_consumed: item.quantity_consumed,
      reserved_quantity: item.reserved_quantity,
      available_quantity: item.available_quantity,
      total_price: item.total_price,
      consumed_value: item.consumed_value,
      reserved_value: item.reserved_value,
      available_value: item.available_value,
    })),
  }
}

export function mapContractAcceptanceToApi(row: ContractAcceptanceRow) {
  return {
    id: row.id,
    action: row.action === "refused" ? "refused" : "accepted",
    notes: row.notes ?? null,
    term_version: row.term_version ?? null,
    term_version_date: row.term_version_date
      ? String(row.term_version_date).slice(0, 10)
      : null,
    supplier_id: row.supplier_id ?? null,
    created_at: row.created_at,
  }
}

/** Payload outbound (Valore → ERP) — mantido para integração existente. */
export function mapContractToOutboundPayload(
  row: ContractRow,
  items: ContractItemRow[] = [],
) {
  const supplier = embedOne(row.suppliers)
  const pc = embedOne(row.payment_conditions)

  return {
    id: row.id,
    code: row.code,
    erp_code: row.erp_code ?? null,
    title: row.title,
    contract_kind: row.contract_kind ?? null,
    type: row.type ?? null,
    status: row.status,
    supplier_code: supplier?.code != null ? String(supplier.code) : null,
    supplier_name: supplier?.name != null ? String(supplier.name) : null,
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
    value: row.value ?? null,
    total_value: row.total_value ?? null,
    payment_condition_code: pc?.code != null ? String(pc.code) : null,
    payment_condition_description:
      pc?.description != null ? String(pc.description) : null,
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
