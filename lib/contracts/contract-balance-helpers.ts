import type { Contract, ContractItem, ContractKind } from "@/types/contracts"

export function contractValueCeiling(contract: Pick<Contract, "value" | "total_value">): number {
  return contract.value ?? contract.total_value ?? 0
}

export function contractAvailableValue(
  contract: Pick<Contract, "value" | "total_value" | "consumed_value" | "reserved_value">,
): number {
  const ceiling = contractValueCeiling(contract)
  return Math.max(0, ceiling - contract.consumed_value - contract.reserved_value)
}

export function contractItemAvailableQuantity(item: Pick<
  ContractItem,
  "quantity_contracted" | "quantity_consumed" | "reserved_quantity" | "eliminated"
>): number {
  if (item.eliminated) return 0
  return Math.max(
    0,
    item.quantity_contracted - item.quantity_consumed - item.reserved_quantity,
  )
}

export function contractItemAvailableValue(item: Pick<
  ContractItem,
  "total_price" | "consumed_value" | "reserved_value" | "eliminated"
>): number {
  if (item.eliminated) return 0
  return Math.max(0, item.total_price - item.consumed_value - item.reserved_value)
}

export function isContractEligibleForPurchaseOrder(
  contract: Pick<Contract, "status" | "start_date" | "end_date">,
  today: Date = new Date(),
): boolean {
  if (contract.status !== "active") return false
  const todayStr = today.toISOString().slice(0, 10)
  if (contract.end_date && contract.end_date < todayStr) return false
  if (contract.start_date && contract.start_date > todayStr) return false
  return true
}

export function validatePoLineQuantity(
  contractKind: ContractKind,
  item: ContractItem,
  quantity: number,
): string | null {
  if (quantity <= 0) return "Quantidade deve ser maior que zero"
  if (contractKind === "por_quantidade") {
    const available = contractItemAvailableQuantity(item)
    if (quantity > available) {
      return `Saldo insuficiente (disponível: ${available})`
    }
  }
  return null
}
