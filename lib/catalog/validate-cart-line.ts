import type { ContractKind } from "@/types/contracts"
import {
  contractItemAvailableQuantity,
  contractItemAvailableValue,
  validatePoLineQuantity,
} from "@/lib/contracts/contract-balance-helpers"
import type { ContractItem } from "@/types/contracts"

export function validateCatalogLineQuantity(
  contractKind: ContractKind,
  item: Pick<
    ContractItem,
    | "quantity_contracted"
    | "quantity_consumed"
    | "reserved_quantity"
    | "eliminated"
    | "total_price"
    | "consumed_value"
    | "reserved_value"
    | "unit_price"
  >,
  quantity: number,
): string | null {
  if (quantity <= 0) return "Quantidade deve ser maior que zero"

  const qtyError = validatePoLineQuantity(contractKind, item as ContractItem, quantity)
  if (qtyError) return qtyError

  if (contractKind === "por_valor") {
    const lineTotal = quantity * (item.unit_price ?? 0)
    const available = contractItemAvailableValue(item)
    if (lineTotal > available) {
      return `Saldo insuficiente (disponível: ${available.toFixed(2)})`
    }
  }

  return null
}

export function catalogItemAvailableQuantity(
  contractKind: ContractKind,
  item: Pick<
    ContractItem,
    | "quantity_contracted"
    | "quantity_consumed"
    | "reserved_quantity"
    | "eliminated"
    | "total_price"
    | "consumed_value"
    | "reserved_value"
    | "unit_price"
  >,
): number | null {
  if (contractKind === "por_quantidade") {
    return contractItemAvailableQuantity(item)
  }
  const unitPrice = item.unit_price ?? 0
  if (unitPrice <= 0) return null
  const availableValue = contractItemAvailableValue(item)
  return Math.floor(availableValue / unitPrice)
}
