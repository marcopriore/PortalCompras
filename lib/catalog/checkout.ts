import type { CatalogCartItem } from "@/lib/catalog/types"
import type { ContractKind } from "@/types/contracts"

export type CartItemRow = {
  id: string
  contract_id: string
  contract_item_id: string
  supplier_id: string
  material_code: string
  material_description: string
  unit_of_measure: string | null
  unit_price: number
  contract_kind: ContractKind
  quantity: number
}

/** @deprecated Use CatalogCheckoutInput from @/lib/catalog/types */
export type { CatalogCheckoutInput } from "@/lib/catalog/types"

export function mapCartRowsToItems(rows: CartItemRow[]): CatalogCartItem[] {
  return rows.map((row) => ({
    id: row.id,
    contractId: row.contract_id,
    contractItemId: row.contract_item_id,
    supplierId: row.supplier_id,
    materialCode: row.material_code,
    materialDescription: row.material_description,
    unitOfMeasure: row.unit_of_measure,
    unitPrice: Number(row.unit_price),
    contractKind: row.contract_kind,
    quantity: Number(row.quantity),
    lineTotal: Number(row.quantity) * Number(row.unit_price),
  }))
}
